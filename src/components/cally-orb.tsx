"use client";

import { useEffect, useRef, useState } from "react";

/** No1Club's idle blob, adapted for Cally. Animation stays outside React renders. */
export function CallyOrb() {
  const host = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element || reducedMotion) return;
    let cancelled = false;
    let dispose = () => {};

    const start = async () => {
      try {
        // Fetch the renderer after the calendar is interactive, in its own chunk.
        const THREE = await import("three");
        if (cancelled) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("webgl2", {
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
          if (!context) return;
          renderer = new THREE.WebGLRenderer({
            canvas,
            context,
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
        } catch {
          return; // The shaded CSS orb also works without WebGL.
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
        camera.position.z = 3.8;
        const geometry = new THREE.SphereGeometry(1, 64, 40);
        const uniforms = { uTime: { value: 0 } };
        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: `
            uniform float uTime;
            varying vec3 vPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;
            void main() {
              vec3 p = position;
              float wave = sin(p.x * 3.6 + uTime * .65) * sin(p.y * 2.8 - uTime * .52)
                + .45 * sin(p.z * 4.8 + p.y * 2.0 + uTime * .8);
              float displacement = wave * .13;
              vec3 gradient = vec3(
                3.6 * cos(p.x * 3.6 + uTime * .65) * sin(p.y * 2.8 - uTime * .52),
                2.8 * sin(p.x * 3.6 + uTime * .65) * cos(p.y * 2.8 - uTime * .52)
                  + .9 * cos(p.z * 4.8 + p.y * 2.0 + uTime * .8),
                2.16 * cos(p.z * 4.8 + p.y * 2.0 + uTime * .8)
              ) * .13;
              vNormal = normalMatrix * normalize(normal - (gradient - normal * dot(gradient, normal)) / (1.0 + displacement));
              p += normal * displacement;
              vPosition = p;
              vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
              vViewPosition = viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }`,
          fragmentShader: `
            uniform float uTime;
            varying vec3 vPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;
            void main() {
              vec3 n = normalize(vNormal);
              vec3 view = normalize(-vViewPosition);
              vec3 light = normalize(vec3(-.6, .85, 1.3));
              float diffuse = max(dot(n, light), 0.0);
              float rim = pow(1.0 - max(dot(n, view), 0.0), 2.4);
              float shine = pow(max(dot(n, normalize(light + view)), 0.0), 65.0);
              float flow = sin(vPosition.y * 2.5 + vPosition.x * 1.6 + uTime * .14) * .5 + .5;
              vec3 moss = vec3(.10, .34, .27);
              vec3 sage = vec3(.57, .78, .57);
              vec3 pearl = vec3(.91, .94, .78);
              vec3 base = mix(moss, sage, smoothstep(.15, .85, flow));
              base = mix(base, vec3(.78, .67, .85), smoothstep(.75, 1.0, -vPosition.x) * .28);
              vec3 color = base * (.38 + diffuse * .83)
                + pearl * rim * .48 + vec3(1.0, .96, .82) * shine * .7;
              gl_FragColor = vec4(color, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        });
        const blob = new THREE.Mesh(geometry, material);
        scene.add(blob);
        element.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");
        let visible = true;
        let contextLost = false;
        let previous = 0;
        let elapsed = 0;
        let lastPaint = 0;
        const resize = () => {
          const width = element.clientWidth;
          const height = element.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const frame = (now: number) => {
          elapsed += previous ? Math.min((now - previous) / 1000, .05) : 0;
          previous = now;
          if (now - lastPaint < 1000 / 30) return;
          lastPaint = now;
          uniforms.uTime.value = elapsed;
          blob.rotation.y = elapsed * .13;
          blob.rotation.z = Math.sin(elapsed * .24) * .09;
          blob.position.y = Math.sin(elapsed * .65) * .035;
          renderer.render(scene, camera);
        };
        const updateLoop = () => {
          previous = 0;
          renderer.setAnimationLoop(visible && !document.hidden && !contextLost ? frame : null);
        };
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          updateLoop();
        });
        const sizeObserver = new ResizeObserver(resize);
        const lost = (event: Event) => {
          event.preventDefault();
          contextLost = true;
          updateLoop();
          setReady(false);
        };
        const restored = () => {
          contextLost = false;
          resize();
          renderer.render(scene, camera);
          setReady(true);
          updateLoop();
        };
        observer.observe(element);
        sizeObserver.observe(element);
        document.addEventListener("visibilitychange", updateLoop);
        renderer.domElement.addEventListener("webglcontextlost", lost);
        renderer.domElement.addEventListener("webglcontextrestored", restored);
        dispose = () => {
          renderer.setAnimationLoop(null);
          observer.disconnect();
          sizeObserver.disconnect();
          document.removeEventListener("visibilitychange", updateLoop);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          renderer.domElement.removeEventListener("webglcontextrestored", restored);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
        resize();
        renderer.render(scene, camera);
        updateLoop();
        setReady(true);
      } catch {
        dispose();
        setReady(false);
      }
    };

    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if ("requestIdleCallback" in window)
        idle = window.requestIdleCallback(() => void start(), { timeout: 2000 });
      else timer = setTimeout(() => void start(), 400);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
      dispose();
      setReady(false);
    };
  }, [reducedMotion]);

  return (
    <span className="cally-orb" aria-hidden="true" data-rendered={ready}>
      <span className="cally-orb-halo" />
      <span className="cally-orb-shadow" />
      <span className="cally-orb-surface">
        <span className="cally-orb-fallback" />
        <span className="cally-orb-canvas" ref={host} />
      </span>
    </span>
  );
}
