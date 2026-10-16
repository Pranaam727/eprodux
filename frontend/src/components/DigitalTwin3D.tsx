// ============================================================
// DigitalTwin3D.tsx — Interactive 3D University Floor Twin
// Built with pure Three.js for maximum React 19 compatibility,
// high performance, and smooth architectural visualization.
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { FloorState, RoomId, RoomState } from '../types';

interface Props {
  floorState: FloorState | null;
  selectedRoomId: RoomId | null;
  onRoomSelect: (roomId: RoomId) => void;
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
}

// Canonical room spatial definitions (X, Z coordinate centers in 3D scene)
const ROOM_3D_LAYOUT: Record<
  RoomId,
  {
    x: number;
    z: number;
    width: number;
    depth: number;
    name: string;
    description: string;
  }
> = {
  seminar_hall: {
    x: -7,
    z: -5.5,
    width: 11,
    depth: 8.5,
    name: 'Seminar Hall',
    description: 'Tiered auditorium seating & podium',
  },
  classroom: {
    x: 7,
    z: -5.5,
    width: 11,
    depth: 8.5,
    name: 'Classroom',
    description: 'Student desks & presentation board',
  },
  lab: {
    x: -7,
    z: 5.5,
    width: 11,
    depth: 8.5,
    name: 'Laboratory',
    description: 'Specialized lab benches & instrumentation',
  },
  office: {
    x: 7,
    z: 5.5,
    width: 11,
    depth: 8.5,
    name: 'Office',
    description: 'Executive workstations & partition desks',
  },
};

export function DigitalTwin3D({
  floorState,
  selectedRoomId,
  onRoomSelect,
  className,
  style,
  height = 540,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [hoveredRoomId, setHoveredRoomId] = useState<RoomId | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'energy' | 'occupancy'>('standard');
  const [isRotating, setIsRotating] = useState(false);

  // References for three.js instance
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const roomMeshesRef = useRef<Map<RoomId, THREE.Mesh>>(new Map());
  const roomLightRefs = useRef<Map<RoomId, THREE.PointLight>>(new Map());
  const animationFrameId = useRef<number | null>(null);
  const resetCameraFn = useRef<() => void>(() => {});

  // ---------------------------------------------------------------
  // Initialize Three.js Scene
  // ---------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 800;
    const heightPx = typeof height === 'number' ? height : container.clientHeight || 540;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03091f);
    scene.fog = new THREE.FogExp2(0x03091f, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / heightPx, 0.1, 1000);
    const defaultPos = new THREE.Vector3(22, 24, 26);
    const targetPos = new THREE.Vector3(0, 0, 0);
    camera.position.copy(defaultPos);
    camera.lookAt(targetPos);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    const cyanRimLight = new THREE.DirectionalLight(0x00b8d9, 0.55);
    cyanRimLight.position.set(-20, 15, -15);
    scene.add(cyanRimLight);

    // 5. Architectural Floor Slab (Deep Navy)
    const slabGeo = new THREE.BoxGeometry(30, 0.8, 26);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x07132d,
      roughness: 0.7,
      metalness: 0.2,
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = -0.4;
    slab.receiveShadow = true;
    scene.add(slab);

    // Grid on floor
    const grid = new THREE.GridHelper(30, 30, 0x1a2945, 0x0b1b38);
    grid.position.y = 0.02;
    scene.add(grid);

    // Corridor indicator
    const corridorGeo = new THREE.PlaneGeometry(28, 2.5);
    const corridorMat = new THREE.MeshBasicMaterial({
      color: 0x0b1b38,
      transparent: true,
      opacity: 0.3,
    });
    const corridor = new THREE.Mesh(corridorGeo, corridorMat);
    corridor.rotation.x = -Math.PI / 2;
    corridor.position.y = 0.03;
    scene.add(corridor);

    // 6. Rooms Construction
    const roomMeshes = new Map<RoomId, THREE.Mesh>();
    const roomLights = new Map<RoomId, THREE.PointLight>();

    (Object.entries(ROOM_3D_LAYOUT) as [RoomId, typeof ROOM_3D_LAYOUT[RoomId]][]).forEach(([id, layout]) => {
      const roomGroup = new THREE.Group();
      roomGroup.position.set(layout.x, 0, layout.z);

      // Floor tile
      const floorGeo = new THREE.BoxGeometry(layout.width - 0.4, 0.1, layout.depth - 0.4);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x1a2235,
        roughness: 0.5,
        metalness: 0.25,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.y = 0.05;
      floorMesh.receiveShadow = true;
      floorMesh.userData = { roomId: id, isRoom: true };
      roomGroup.add(floorMesh);
      roomMeshes.set(id, floorMesh);

      // Cutaway Walls (height: 1.4 for attractive architectural isometric view)
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x24324d,
        roughness: 0.8,
        metalness: 0.1,
      });
      const wallHeight = 1.3;
      const wallThick = 0.25;

      // North wall
      const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(layout.width - 0.2, wallHeight, wallThick),
        wallMat,
      );
      northWall.position.set(0, wallHeight / 2, -layout.depth / 2 + wallThick / 2);
      northWall.castShadow = true;
      northWall.receiveShadow = true;
      roomGroup.add(northWall);

      // Exterior wall (West for left rooms, East for right rooms)
      const isLeft = layout.x < 0;
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick, wallHeight, layout.depth - 0.2),
        wallMat,
      );
      sideWall.position.set((isLeft ? -1 : 1) * (layout.width / 2 - wallThick / 2), wallHeight / 2, 0);
      sideWall.castShadow = true;
      sideWall.receiveShadow = true;
      roomGroup.add(sideWall);

      // Interior Low Half-Walls with doorway gap
      const innerWallPart = new THREE.Mesh(
        new THREE.BoxGeometry(layout.width * 0.35, wallHeight * 0.6, wallThick),
        wallMat,
      );
      innerWallPart.position.set(-layout.width * 0.25, (wallHeight * 0.6) / 2, layout.depth / 2 - wallThick / 2);
      innerWallPart.castShadow = true;
      roomGroup.add(innerWallPart);

      // Room-specific approximated furniture
      createRoomFurniture(id, roomGroup);

      // Room ceiling point light
      const pLight = new THREE.PointLight(0x22c55e, 1.2, 12, 1.5);
      pLight.position.set(0, 3.5, 0);
      pLight.castShadow = false;
      roomGroup.add(pLight);
      roomLights.set(id, pLight);

      scene.add(roomGroup);
    });

    roomMeshesRef.current = roomMeshes;
    roomLightRefs.current = roomLights;

    // -------------------------------------------------------------
    // Orbit Interaction Logic (Damped and Constrained)
    // -------------------------------------------------------------
    let isDragging = false;
    let isPanning = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    // Spherical coordinates
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(targetPos));
    const targetSpherical = spherical.clone();
    const currentTarget = targetPos.clone();
    const desiredTarget = targetPos.clone();

    resetCameraFn.current = () => {
      targetSpherical.radius = 35;
      targetSpherical.theta = Math.PI / 4;
      targetSpherical.phi = Math.PI / 3.4;
      desiredTarget.set(0, 0, 0);
    };

    const canvas = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isDragging = true;
      if (e.button === 2 || e.shiftKey) {
        isDragging = false;
        isPanning = true;
      }
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      if (isDragging) {
        targetSpherical.theta -= deltaX * 0.007;
        targetSpherical.phi -= deltaY * 0.007;
        // Clamp elevation angle so user never flips upside down
        targetSpherical.phi = Math.max(0.2, Math.min(Math.PI / 2.1, targetSpherical.phi));
      } else if (isPanning) {
        const panSpeed = 0.03;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        desiredTarget.addScaledVector(right, -deltaX * panSpeed);
        desiredTarget.y += deltaY * panSpeed;
        desiredTarget.x = Math.max(-18, Math.min(18, desiredTarget.x));
        desiredTarget.z = Math.max(-18, Math.min(18, desiredTarget.z));
      }

      // Raycasting for hover
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const interactiveObjects = Array.from(roomMeshes.values());
      const intersects = raycaster.intersectObjects(interactiveObjects, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const hitRoomId = hit.userData.roomId as RoomId;
        setHoveredRoomId(hitRoomId);
        canvas.style.cursor = 'pointer';
      } else {
        setHoveredRoomId(null);
        canvas.style.cursor = isDragging || isPanning ? 'grabbing' : 'grab';
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      isPanning = false;
      canvas.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetSpherical.radius += e.deltaY * 0.03;
      // Clamp zoom bounds
      targetSpherical.radius = Math.max(12, Math.min(48, targetSpherical.radius));
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const interactiveObjects = Array.from(roomMeshes.values());
      const intersects = raycaster.intersectObjects(interactiveObjects, false);

      if (intersects.length > 0) {
        const hitRoomId = intersects[0].object.userData.roomId as RoomId;
        onRoomSelect(hitRoomId);
      }
    };

    // Touch support for tablets & mobile
    let touchStartDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - prevMouseX;
        const deltaY = e.touches[0].clientY - prevMouseY;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;

        targetSpherical.theta -= deltaX * 0.007;
        targetSpherical.phi -= deltaY * 0.007;
        targetSpherical.phi = Math.max(0.2, Math.min(Math.PI / 2.1, targetSpherical.phi));
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = touchStartDist - dist;
        touchStartDist = dist;
        targetSpherical.radius += delta * 0.05;
        targetSpherical.radius = Math.max(12, Math.min(48, targetSpherical.radius));
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Resize handler
    const onResize = () => {
      if (!container || !camera || !renderer) return;
      const newWidth = container.clientWidth;
      const newHeight = typeof height === 'number' ? height : container.clientHeight || 540;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', onResize);

    // -------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Gentle auto-rotation when user is not interacting
      if (isRotating && !isDragging && !isPanning) {
        targetSpherical.theta += delta * 0.15;
      }

      // Damping camera spherical movement
      spherical.radius += (targetSpherical.radius - spherical.radius) * 0.1;
      spherical.theta += (targetSpherical.theta - spherical.theta) * 0.1;
      spherical.phi += (targetSpherical.phi - spherical.phi) * 0.1;

      currentTarget.lerp(desiredTarget, 0.1);

      camera.position.setFromSpherical(spherical).add(currentTarget);
      camera.lookAt(currentTarget);

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);

      renderer.dispose();
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [height, isRotating, onRoomSelect]);

  // ---------------------------------------------------------------
  // Update Room Materials on state, selection, or viewMode changes
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!roomMeshesRef.current || !roomLightRefs.current) return;

    roomMeshesRef.current.forEach((mesh, roomId) => {
      const room: RoomState | undefined = floorState?.rooms[roomId];
      const pLight = roomLightRefs.current.get(roomId);
      const isSelected = selectedRoomId === roomId;
      const isHovered = hoveredRoomId === roomId;

      const lightState = room?.lightState ?? 'UNKNOWN';
      const conn = room?.connectionState ?? 'unknown';
      const occ = room?.occupancy ?? null;
      const energy = room?.energyKwh ?? null;

      let floorColor = 0x1a2235;
      let emissiveColor = 0x000000;
      let emissiveIntensity = 0.0;
      let lightColor = 0x22c55e;
      let lightIntensity = 0.8;

      if (viewMode === 'energy') {
        // Energy Heatmap Mode
        if (energy !== null && energy > 2.0) {
          floorColor = 0xef4444; // High energy waste
          emissiveColor = 0x7f1d1d;
          emissiveIntensity = 0.4;
        } else if (energy !== null && energy > 1.0) {
          floorColor = 0xf59e0b;
          emissiveColor = 0x78350f;
          emissiveIntensity = 0.3;
        } else {
          floorColor = 0x059669;
          emissiveColor = 0x064e3b;
          emissiveIntensity = 0.3;
        }
      } else if (viewMode === 'occupancy') {
        // Occupancy Mode
        if (occ !== null && occ > 10) {
          floorColor = 0x0284c7;
          emissiveColor = 0x0369a1;
          emissiveIntensity = 0.4;
        } else if (occ !== null && occ > 0) {
          floorColor = 0x0ea5e9;
          emissiveColor = 0x0284c7;
          emissiveIntensity = 0.25;
        } else {
          floorColor = 0x1e293b;
        }
      } else {
        // Standard Digital Twin View
        if (conn === 'offline') {
          floorColor = 0x220a12;
          emissiveColor = 0xff5c69;
          emissiveIntensity = 0.15;
          lightColor = 0xff5c69;
          lightIntensity = 0.2;
        } else if (lightState === 'ON') {
          floorColor = 0x08241c;
          emissiveColor = 0xa3d900;
          emissiveIntensity = 0.16;
          lightColor = 0xa3d900;
          lightIntensity = 1.4;
        } else if (lightState === 'OFF') {
          floorColor = 0x07132d;
          emissiveColor = 0x00b8d9;
          emissiveIntensity = 0.03;
          lightColor = 0x1a2945;
          lightIntensity = 0.15;
        } else {
          floorColor = 0x1e1b12;
          emissiveColor = 0xf5b82e;
          emissiveIntensity = 0.08;
          lightColor = 0xf5b82e;
          lightIntensity = 0.6;
        }
      }

      // Selection or Hover Highlights
      if (isSelected) {
        emissiveColor = 0xa3d900;
        emissiveIntensity = Math.max(emissiveIntensity, 0.45);
      } else if (isHovered) {
        emissiveColor = 0x00b8d9;
        emissiveIntensity = Math.max(emissiveIntensity, 0.28);
      }

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(floorColor);
      mat.emissive.setHex(emissiveColor);
      mat.emissiveIntensity = emissiveIntensity;
      mat.needsUpdate = true;

      if (pLight) {
        pLight.color.setHex(lightColor);
        pLight.intensity = lightIntensity;
      }
    });
  }, [floorState, selectedRoomId, hoveredRoomId, viewMode]);

  // Reset Camera action
  const handleResetCamera = useCallback(() => {
    resetCameraFn.current();
  }, []);

  // ---------------------------------------------------------------
  // WebGL Fallback (Render 2D Plan if browser/GPU cannot run WebGL)
  // ---------------------------------------------------------------
  if (!webGlSupported) {
    return (
      <div
        className={`card ${className || ''}`}
        style={{
          padding: 24,
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          ...style,
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏢</div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
          WebGL Hardware Acceleration Disabled
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 480, margin: '0 auto 16px' }}>
          Your browser is unable to initialize a 3D WebGL context. You can still monitor all rooms using the interactive 2D floorplan.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {(Object.entries(ROOM_3D_LAYOUT) as [RoomId, typeof ROOM_3D_LAYOUT[RoomId]][]).map(([id, layout]) => {
            const room = floorState?.rooms[id];
            return (
              <button
                key={id}
                onClick={() => onRoomSelect(id)}
                className={`card ${selectedRoomId === id ? 'card--accent' : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 700 }}>{layout.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Occupants: {room?.occupancy ?? 'UNKNOWN'} · Lights: {room?.lightState ?? 'UNKNOWN'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Normal 3D Canvas Rendering with Floating HUD
  // ---------------------------------------------------------------
  return (
    <div
      className={`digital-twin-3d-wrap ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-card)',
        background: '#0a0f1e',
        ...style,
      }}
    >
      {/* Three.js DOM Container */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating 3D Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(10, 15, 30, 0.82)',
          backdropFilter: 'blur(10px)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '0.05em' }}>
          3D FLOOR TWIN
        </span>
        <div style={{ width: 1, height: 14, background: 'rgba(255, 255, 255, 0.15)' }} />
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Drag to rotate · Scroll to zoom</span>
      </div>

      {/* View Mode Switcher */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 6,
          zIndex: 10,
        }}
      >
        {(['standard', 'energy', 'occupancy'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              background: viewMode === mode ? 'var(--accent-green-bg)' : 'rgba(10, 15, 30, 0.75)',
              border: `1px solid ${viewMode === mode ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: viewMode === mode ? 'var(--accent-green)' : 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.70rem',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              textTransform: 'capitalize',
            }}
          >
            {mode === 'standard' ? 'Architecture' : mode === 'energy' ? 'Energy Waste' : 'Occupancy'}
          </button>
        ))}

        <button
          onClick={handleResetCamera}
          title="Reset Camera Angle"
          style={{
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--text-primary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.70rem',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⟲ Reset View
        </button>

        <button
          onClick={() => setIsRotating((prev) => !prev)}
          title="Toggle Auto-Rotation"
          style={{
            background: isRotating ? 'var(--accent-blue-bg)' : 'rgba(10, 15, 30, 0.75)',
            border: `1px solid ${isRotating ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.15)'}`,
            color: isRotating ? 'var(--accent-blue)' : 'var(--text-secondary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.70rem',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          {isRotating ? '⏸ Pause Spin' : '▶ Orbit'}
        </button>
      </div>

      {/* Floating 4-Room Status Chips at bottom of 3D Canvas */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          right: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {(Object.entries(ROOM_3D_LAYOUT) as [RoomId, typeof ROOM_3D_LAYOUT[RoomId]][]).map(([id, layout]) => {
          const room = floorState?.rooms[id];
          const isSelected = selectedRoomId === id;
          const isHovered = hoveredRoomId === id;
          const occ = room?.occupancy ?? null;
          const lightState = room?.lightState ?? 'UNKNOWN';

          return (
            <div
              key={id}
              onClick={() => onRoomSelect(id)}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                background: isSelected
                  ? 'rgba(34, 197, 94, 0.18)'
                  : isHovered
                  ? 'rgba(30, 42, 64, 0.9)'
                  : 'rgba(17, 24, 39, 0.82)',
                border: `1px solid ${
                  isSelected ? 'var(--accent-green)' : isHovered ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.08)'
                }`,
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {layout.name}
                </span>
                <span
                  className={`status-dot status-dot--${
                    room?.connectionState === 'offline'
                      ? 'offline'
                      : lightState === 'ON'
                      ? 'on'
                      : 'off'
                  }`}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: 3,
                  fontSize: '0.66rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  {occ !== null ? `${occ} occupants` : 'Occ. UNKNOWN'}
                </span>
                <span style={{ color: lightState === 'ON' ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  💡 {lightState}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Helper: Approximate 3D Furniture per Room
// -----------------------------------------------------------------
function createRoomFurniture(roomId: RoomId, group: THREE.Group) {
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const apparatusMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.4 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });

  if (roomId === 'seminar_hall') {
    // Auditorium Rows
    for (let r = 0; r < 3; r++) {
      const zOffset = -2 + r * 1.5;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(7 - r * 0.8, 0.45, 0.5), deskMat);
      bench.position.set(0, 0.25 + r * 0.15, zOffset);
      bench.castShadow = true;
      group.add(bench);
    }
    // Speaker Podium
    const podium = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), deskMat);
    podium.position.set(0, 0.45, 2.5);
    group.add(podium);

    // Projector Screen Wall
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), screenMat);
    screen.position.set(0, 0.8, 3.8);
    screen.rotation.y = Math.PI;
    group.add(screen);
  } else if (roomId === 'classroom') {
    // 2x3 Grid of Student Desks
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col += 2) {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.9), deskMat);
        desk.position.set(col * 2.5, 0.33, row * 2.0);
        desk.castShadow = true;
        group.add(desk);

        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), chairMat);
        chair.position.set(col * 2.5, 0.22, row * 2.0 - 0.7);
        group.add(chair);
      }
    }
    // Teacher Desk
    const teacherDesk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 1.1), deskMat);
    teacherDesk.position.set(0, 0.37, 3.0);
    group.add(teacherDesk);
  } else if (roomId === 'lab') {
    // 2 Long Scientific Lab Benches
    for (let side = -1; side <= 1; side += 2) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 1.4), deskMat);
      bench.position.set(0, 0.4, side * 2.2);
      bench.castShadow = true;
      group.add(bench);

      // Apparatus Blocks
      const eq1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), apparatusMat);
      eq1.position.set(-2, 0.95, side * 2.2);
      group.add(eq1);

      const eq2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12), apparatusMat);
      eq2.position.set(2, 0.95, side * 2.2);
      group.add(eq2);
    }
  } else if (roomId === 'office') {
    // 4 Office Cubicles / Workstations
    const positions = [
      [-2.6, -1.8],
      [2.6, -1.8],
      [-2.6, 1.8],
      [2.6, 1.8],
    ];
    positions.forEach(([x, z]) => {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.4), deskMat);
      desk.position.set(x, 0.35, z);
      desk.castShadow = true;
      group.add(desk);

      // Computer Monitor
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), screenMat);
      monitor.position.set(x, 0.85, z + 0.3);
      group.add(monitor);

      // Swivel Chair
      const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), chairMat);
      chair.position.set(x, 0.25, z - 0.7);
      group.add(chair);
    });
  }
}
