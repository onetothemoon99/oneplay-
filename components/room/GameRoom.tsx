'use client';

/* ---------------------------------------------------------
   ONEPLAY — the room

   The library as a gallery: eight framed covers hung on the back wall
   of a dark room, lit warm from above and cool from the left. Moving
   the pointer looks around; hovering lifts a frame off the wall and
   throws its light onto the plaster; clicking opens the game.

   The canvas is decoration. Every game is also a real link in
   `RoomSection`'s list — the scene reflects focus there, so the room
   is navigable by keyboard and legible to a crawler without any of
   this running.
--------------------------------------------------------- */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Game } from '@/lib/games';
import { paintCover, paintPlaque } from '@/lib/coverTexture';

/* Room, in metres. The camera stands just inside the door. */
const ROOM = { width: 26, height: 7.4, depth: 13 };
const WALL_Z = -ROOM.depth / 2;

/* Four across, two down. The viewer stands towards the left of the room and
   looks right, which leaves the near-left corner empty for the copy. */
const COLUMNS = [3.5, 6.2, 8.9, 11.6];
const ROWS = [4.15, 1.6];
const COVER = { width: 1.62, height: 2.16, depth: 0.07 };

/* What the stacked camera has to fit: the whole grid of pictures plus their
   plaques, with a little air. */
const ART = { x: 7.55, y: 2.85, width: 10.4, height: 5.9 };
const FRAME_LIP = 0.12;

const INK = 0x1b1d26;
const PAPER = 0xf5f3ee;
const CARTRIDGE = 0xf2794a;
const SIGNAL = 0x7e92f5;

/** One hung picture, and the handful of things the loop animates on it. */
interface Picture {
  group: THREE.Group;
  cover: THREE.Mesh;
  halo: THREE.PointLight;
  lamp: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  baseZ: number;
  game: Game;
  index: number;
}

export interface GameRoomProps {
  games: Game[];
  onHover?: (game: Game | null, index: number) => void;
  onSelect?: (game: Game, index: number) => void;
  /** Which frame the DOM list currently has focus on, or -1. */
  focusedIndex?: number;
  className?: string;
}

export default function GameRoom({ games, onHover, onSelect, focusedIndex = -1, className = '' }: GameRoomProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ setFocus: (index: number) => void } | null>(null);

  // Keep the callbacks in a ref: the scene is built once and must not be torn
  // down every time a parent re-renders. Written in an effect, not during
  // render — a ref is not allowed to change while React is rendering.
  const handlers = useRef({ onHover, onSelect });
  useEffect(() => { handlers.current = { onHover, onSelect }; }, [onHover, onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      return undefined; // no WebGL — RoomSection keeps showing its grid
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.append(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111219);
    scene.fog = new THREE.Fog(0x111219, 12, 26);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
    // Wide: the viewer stands left and looks across the room, which leaves the
    // near corner for the copy. Narrow: the copy is above the canvas instead,
    // so the camera squares up on the wall and steps back.
    const HOME = new THREE.Vector3(-3.2, 2.15, 5.0);
    const LOOK = new THREE.Vector3(5.2, 3.75, WALL_Z);
    let home = HOME.clone();
    let look = LOOK.clone();
    camera.position.copy(HOME);
    camera.lookAt(LOOK);

    /* ---------------- the room itself ---------------- */
    const plaster = new THREE.MeshStandardMaterial({ color: 0x24262f, roughness: 0.95, metalness: 0 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x191b22, roughness: 0.55, metalness: 0.08 });

    const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), plaster);
    back.position.set(0, ROOM.height / 2, WALL_Z);
    back.receiveShadow = true;
    scene.add(back);

    const left = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), plaster);
    left.rotation.y = Math.PI / 2;
    left.position.set(-ROOM.width / 2, ROOM.height / 2, 0);
    left.receiveShadow = true;
    scene.add(left);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), plaster);
    right.rotation.y = -Math.PI / 2;
    right.position.set(ROOM.width / 2, ROOM.height / 2, 0);
    scene.add(right);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), plaster);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM.height;
    scene.add(ceiling);

    // skirting board, so wall and floor do not simply dissolve into each other
    const skirting = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM.width, 0.22, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x2c2f3a, roughness: 0.8 })
    );
    skirting.position.set(0, 0.11, WALL_Z + 0.04);
    scene.add(skirting);

    /* ---------------- light ---------------- */
    scene.add(new THREE.AmbientLight(0xb9c0d6, 0.55));

    const warm = new THREE.SpotLight(CARTRIDGE, 110, 24, Math.PI / 4.4, 0.6, 1.4);
    warm.position.set(7.6, ROOM.height - 0.4, WALL_Z + 5.2);
    warm.target.position.set(7.6, 3, WALL_Z);
    warm.castShadow = true;
    warm.shadow.mapSize.set(1024, 1024);
    scene.add(warm, warm.target);

    const cool = new THREE.PointLight(SIGNAL, 55, 26, 1.6);
    cool.position.set(-7.5, 4.2, 1.5);
    scene.add(cool);

    const bounce = new THREE.PointLight(0xfff2e6, 18, 20, 2);
    bounce.position.set(2, 1.2, 2.5);
    scene.add(bounce);

    /* ---------------- the hung pictures ---------------- */
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x0f1015, roughness: 0.45, metalness: 0.35 });
    const mountMaterial = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.9 });

    const frameGeometry = new THREE.BoxGeometry(
      COVER.width + FRAME_LIP * 2,
      COVER.height + FRAME_LIP * 2,
      COVER.depth
    );
    const coverGeometry = new THREE.PlaneGeometry(COVER.width, COVER.height);
    const plaqueGeometry = new THREE.PlaneGeometry(1.18, 0.3);

    const pictures: Picture[] = games.slice(0, COLUMNS.length * ROWS.length).map((game, index) => {
      const group = new THREE.Group();
      const x = COLUMNS[index % COLUMNS.length];
      const y = ROWS[Math.floor(index / COLUMNS.length)];
      group.position.set(x, y, WALL_Z + COVER.depth / 2 + 0.01);

      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.castShadow = true;
      group.add(frame);

      // a paper mount peeking out from behind the picture
      const mount2 = new THREE.Mesh(
        new THREE.PlaneGeometry(COVER.width + FRAME_LIP * 0.9, COVER.height + FRAME_LIP * 0.9),
        mountMaterial
      );
      mount2.position.z = COVER.depth / 2 + 0.002;
      group.add(mount2);

      const texture = new THREE.CanvasTexture(paintCover(game));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const cover = new THREE.Mesh(
        coverGeometry,
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0.05 })
      );
      cover.position.z = COVER.depth / 2 + 0.004;
      cover.userData.index = index;
      group.add(cover);

      const plaqueTexture = new THREE.CanvasTexture(paintPlaque(game));
      plaqueTexture.colorSpace = THREE.SRGBColorSpace;
      plaqueTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const plaque = new THREE.Mesh(
        plaqueGeometry,
        new THREE.MeshStandardMaterial({ map: plaqueTexture, roughness: 0.55, metalness: 0.25 })
      );
      plaque.position.set(0, -(COVER.height / 2 + FRAME_LIP + 0.26), COVER.depth / 2 + 0.004);
      group.add(plaque);

      // a little brass picture light over each frame — geometry only, the
      // glow itself comes from the halo below, so this costs nothing to draw
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.07, 0.14),
        new THREE.MeshStandardMaterial({
          color: 0x2a2c36, roughness: 0.35, metalness: 0.7,
          emissive: 0xffcfa8, emissiveIntensity: 0.45
        })
      );
      lamp.position.set(0, COVER.height / 2 + FRAME_LIP + 0.24, 0.16);
      group.add(lamp);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.2, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a2c36, roughness: 0.4, metalness: 0.7 })
      );
      arm.position.set(0, COVER.height / 2 + FRAME_LIP + 0.16, 0.02);
      group.add(arm);

      // the wash the lamp throws down the picture, brighter when it is lifted
      const halo = new THREE.PointLight(0xffd9c2, 0.5, 3.4, 2);
      halo.position.set(0, COVER.height / 2, 0.55);
      group.add(halo);

      scene.add(group);
      return { group, cover, halo, lamp, baseZ: group.position.z, game, index };
    });

    /* ---------------- interaction ---------------- */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);   // -1..1
    const aim = new THREE.Vector2(0, 0);       // smoothed, drives the camera
    let hovered = -1;
    let externalFocus = focusedIndex;
    let pointerInside = false;

    const pickables = pictures.map((p) => p.cover);

    function setHovered(next: number) {
      if (next === hovered) return;
      hovered = next;
      handlers.current.onHover?.(next === -1 ? null : pictures[next].game, next);
      renderer.domElement.style.cursor = next === -1 ? '' : 'pointer';
    }

    function pickAt(event: PointerEvent | MouseEvent): number {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return hit ? (hit.object.userData.index as number) : -1;
    }

    function onPointerMove(event: PointerEvent) {
      pointerInside = true;
      setHovered(pickAt(event));
      aim.set(pointer.x, pointer.y);
    }

    function onPointerLeave() {
      pointerInside = false;
      setHovered(-1);
    }

    function onClick(event: MouseEvent) {
      const index = pickAt(event);
      if (index !== -1) handlers.current.onSelect?.(pictures[index].game, index);
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    /* ---------------- size ---------------- */
    function resize() {
      const { clientWidth: w, clientHeight: h } = mount!;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;

      if (w < 900) {
        // Stacked: square up on the pictures and stand at whatever distance
        // actually fits them, rather than at a number picked by eye.
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const forHeight = (ART.height / 2) / Math.tan(vFov / 2);
        const forWidth = (ART.width / 2) / Math.tan(vFov / 2) / camera.aspect;
        const distance = Math.max(forHeight, forWidth) * 1.06;
        home = new THREE.Vector3(ART.x, ART.y, WALL_Z + distance);
        look = new THREE.Vector3(ART.x, ART.y, WALL_Z);
      } else {
        const pullback = THREE.MathUtils.clamp(2.1 - camera.aspect * 0.7, 0, 3.4);
        home = new THREE.Vector3(HOME.x + pullback * 0.9, HOME.y, HOME.z + pullback * 2.4);
        look = LOOK.clone();
      }
      camera.position.copy(home);
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    /* ---------------- loop ---------------- */
    let running = true;
    let frame = 0;
    const clock = new THREE.Clock();

    const visibility = new IntersectionObserver(([entry]) => { running = entry.isIntersecting; });
    visibility.observe(mount);

    function tick() {
      frame = requestAnimationFrame(tick);
      if (!running || document.hidden) return;

      const t = clock.getElapsedTime();
      const active = externalFocus !== -1 ? externalFocus : hovered;

      if (!reduceMotion) {
        // look around, gently, and drift when nobody is pointing
        const idleX = pointerInside ? aim.x : Math.sin(t * 0.18) * 0.35;
        const idleY = pointerInside ? aim.y : Math.sin(t * 0.13) * 0.22;
        camera.position.x += (home.x + idleX * 1.15 - camera.position.x) * 0.045;
        camera.position.y += (home.y + idleY * 0.5 - camera.position.y) * 0.045;
      }
      camera.lookAt(look);

      for (const picture of pictures) {
        const on = picture.index === active;
        const targetZ = picture.baseZ + (on ? 0.26 : 0);
        picture.group.position.z += (targetZ - picture.group.position.z) * 0.16;
        picture.halo.intensity += ((on ? 3.1 : 0.5) - picture.halo.intensity) * 0.16;
        picture.lamp.material.emissiveIntensity += ((on ? 1.6 : 0.45) - picture.lamp.material.emissiveIntensity) * 0.16;
        const targetTilt = on ? -0.06 : 0;
        picture.group.rotation.x += (targetTilt - picture.group.rotation.x) * 0.16;
      }

      renderer.render(scene, camera);
    }
    tick();

    apiRef.current = { setFocus: (index: number) => { externalFocus = index; } };

    /* ---------------- teardown ---------------- */
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!material) continue;
          (material as THREE.MeshStandardMaterial).map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
    // Built once: `games` is the static catalogue and the callbacks live in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // focus moving through the DOM list lights the matching frame
  useEffect(() => { apiRef.current?.setFocus(focusedIndex); }, [focusedIndex]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
