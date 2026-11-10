"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Expression } from "@/lib/expressions";

export type AvatarMode = "idle" | "listening" | "thinking" | "speaking";

type Pose = { eyeScale: number; brow: number; mouthW: number; mouthH: number; tilt: number; lean: number; color: number };

function poseFor(expression: Expression, mode: AvatarMode): Pose {
  const base: Pose = { eyeScale: 1, brow: 0, mouthW: 0.5, mouthH: 0.1, tilt: 0, lean: 0, color: 0x22d3ee };
  switch (expression) {
    case "happy": return { ...base, eyeScale: 0.7, brow: -0.25, mouthW: 0.8, mouthH: 0.24, tilt: 0.06, color: 0x34d399 };
    case "sad": return { ...base, eyeScale: 0.9, brow: 0.4, mouthW: 0.4, mouthH: 0.07, tilt: -0.1, lean: 0.12, color: 0x60a5fa };
    case "surprised": return { ...base, eyeScale: 1.55, brow: -0.45, mouthW: 0.35, mouthH: 0.5, tilt: 0, color: 0xfacc15 };
    case "thinking": return { ...base, eyeScale: 1, brow: 0.15, mouthW: 0.42, mouthH: 0.06, lean: -0.18 };
    default: return base;
  }
  // mode overrides are applied by the caller via lean/speaking handling
}

export default function UltronAvatar({ expression, mode }: { expression: Expression; mode: AvatarMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ expression, mode });
  stateRef.current = { expression, mode };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = null;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 5.2);
    camera.lookAt(0, 0.2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(3, 5, 4); scene.add(dir);
    const glow = new THREE.PointLight(0x22d3ee, 12, 10); glow.position.set(0, 1, 3); scene.add(glow);

    const metal = new THREE.MeshStandardMaterial({ color: 0x2a3648, metalness: 0.9, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.6, roughness: 0.5 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x0e7490, metalness: 0.4, roughness: 0.3, emissive: 0x22d3ee, emissiveIntensity: 1.2 });

    const ultron = new THREE.Group(); scene.add(ultron);
    const head = new THREE.Group(); head.position.y = 1.15; ultron.add(head);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 1.15), metal); head.add(headMesh);
    const face = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.1), dark); face.position.z = 0.58; head.add(face);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2 });
    const eyeGeo = new THREE.SphereGeometry(0.15, 24, 24);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.4, 0.18, 0.66); head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.4, 0.18, 0.66); head.add(eyeR);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.4 });
    const browGeo = new THREE.BoxGeometry(0.38, 0.07, 0.05);
    const browL = new THREE.Mesh(browGeo, browMat); browL.position.set(-0.4, 0.44, 0.66); head.add(browL);
    const browR = new THREE.Mesh(browGeo, browMat); browR.position.set(0.4, 0.44, 0.66); head.add(browR);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.05), eyeMat); mouth.position.set(0, -0.36, 0.66); head.add(mouth);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), browMat); antenna.position.set(0.55, 0.85, 0); head.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), eyeMat); antennaTip.position.set(0.55, 1.12, 0); head.add(antennaTip);

    const torso = new THREE.Group(); torso.position.y = -0.15; ultron.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.9), metal); torso.add(chest);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 32), accent); core.rotation.x = Math.PI / 2; core.position.z = 0.48; torso.add(core);
    const shoulderGeo = new THREE.SphereGeometry(0.32, 20, 20);
    const shL = new THREE.Mesh(shoulderGeo, metal); shL.position.set(-1.0, 0.35, 0); torso.add(shL);
    const shR = new THREE.Mesh(shoulderGeo, metal); shR.position.set(1.0, 0.35, 0); torso.add(shR);

    let raf = 0; let nextBlink = 2.5;
    const cur: Pose = { eyeScale: 1, brow: 0, mouthW: 0.5, mouthH: 0.1, tilt: 0, lean: 0, color: 0x22d3ee };
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const { expression: ex, mode: md } = stateRef.current;
      const target = poseFor(ex, md);
      if (md === "listening") target.lean = 0.22;
      if (md === "thinking") target.lean = -0.2;
      // Smoothly lerp toward the target pose so expressions morph, not snap.
      const k = 0.08;
      cur.eyeScale += (target.eyeScale - cur.eyeScale) * k;
      cur.brow += (target.brow - cur.brow) * k;
      cur.mouthW += (target.mouthW - cur.mouthW) * k;
      cur.mouthH += (target.mouthH - cur.mouthH) * k;
      cur.tilt += (target.tilt - cur.tilt) * k;
      cur.lean += (target.lean - cur.lean) * k;

      // Blink: brief eye squash every few seconds.
      let blink = 1;
      if (t > nextBlink) { if (t < nextBlink + 0.13) blink = 0.12; else nextBlink = t + 2 + Math.random() * 3; }
      eyeL.scale.set(cur.eyeScale, cur.eyeScale * blink, 1);
      eyeR.scale.set(cur.eyeScale, cur.eyeScale * blink, 1);
      eyeMat.color.setHex(target.color); eyeMat.emissive.setHex(target.color);
      (glow as THREE.PointLight).color.setHex(target.color);
      browL.rotation.z = cur.brow; browR.rotation.z = -cur.brow;

      // Speaking mouth: rhythmic open/close while TTS is active. This is
      // animated lip movement, not phoneme-accurate lip sync.
      let mh = cur.mouthH;
      if (md === "speaking") mh = 0.12 + Math.abs(Math.sin(t * 13)) * 0.42 + Math.abs(Math.sin(t * 7.3)) * 0.15;
      mouth.scale.set(cur.mouthW / 0.5, mh / 0.1, 1);

      // Idle life: breathing, sway, bob.
      const breathe = Math.sin(t * 1.8) * 0.02;
      torso.scale.y = 1 + breathe;
      head.position.y = 1.15 + Math.sin(t * 1.8) * 0.04;
      head.rotation.y = Math.sin(t * 0.6) * 0.12 + cur.tilt;
      head.rotation.x = cur.lean + Math.sin(t * 0.9) * 0.03;
      ultron.rotation.y = Math.sin(t * 0.4) * 0.05;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
      renderer.dispose(); mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="avatar-canvas" aria-label="3D ULTRON character" />;
}
