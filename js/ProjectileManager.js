// ProjectileManager.js
import * as THREE from 'three';
import {
    // --- 通常ビーム用 ---
    BEAM_COLOR, BEAM_RADIUS, BEAM_LENGTH, BEAM_SPEED, BEAM_SPAWN_OFFSET_FORWARD,
    CHARACTER_HEIGHT,
    MAX_BEAM_LIFETIME, BEAM_RAYCAST_WIDTH,
    BEAM_RAYCAST_HEIGHT, BEAM_RAYCAST_NUM_RAYS_HORIZONTAL, BEAM_RAYCAST_NUM_RAYS_VERTICAL,

    // --- リング用 ---
    RING_01_ENABLED, RING_01_COLOR, RING_01_RADIUS, RING_01_THICKNESS, RING_01_DURATION,
    RING_01_SPAWN_OFFSET_FORWARD, RING_01_SPAWN_OFFSET_UP,
    RING_02_ENABLED, RING_02_COLOR, RING_02_RADIUS, RING_02_THICKNESS, RING_02_DURATION,
    RING_02_SPAWN_OFFSET_FORWARD, RING_02_SPAWN_OFFSET_UP,
    RING_03_ENABLED, RING_03_COLOR, RING_03_RADIUS, RING_03_THICKNESS, RING_03_DURATION,
    RING_03_SPAWN_OFFSET_FORWARD, RING_03_SPAWN_OFFSET_UP,

    // --- 魔貫光殺砲風ビーム用 (constants.js からインポート) ---
    MAKANKO_BEAM_TYPE_ENABLED,
    MAKANKO_CORE_BEAM_RADIUS, MAKANKO_CORE_BEAM_COLOR, MAKANKO_BEAM_LENGTH,
    MAKANKO_CORE_EMISSIVE_INTENSITY, MAKANKO_CORE_METALNESS, MAKANKO_CORE_ROUGHNESS,
    MAKANKO_SPIRAL_COLOR, MAKANKO_NUM_SPIRAL_STRANDS,
    MAKANKO_SPIRAL_TUBE_RADIUS, MAKANKO_SPIRAL_TUBE_SEGMENTS,
    MAKANKO_SPIRAL_PATH_POINTS, MAKANKO_SPIRAL_DISTANCE_FROM_CENTER,
    MAKANKO_SPIRAL_PITCH, MAKANKO_SPIRAL_ROTATION_SPEED_FACTOR,
    MAKANKO_SPIRAL_EMISSIVE_INTENSITY, MAKANKO_SPIRAL_METALNESS, MAKANKO_SPIRAL_ROUGHNESS,
    MAKANKO_BEAM_SPEED,
    MAKANKO_MAX_BEAM_LIFETIME,

} from './constants.js';

export class ProjectileManager {
    constructor(scene, raycastTargetsGetter, effectManager) {
        this.scene = scene;
        this.getRaycastTargets = raycastTargetsGetter;
        this.effectManager = effectManager;
        this.activeBeams = [];
        this.activeRings = [];
        this.clock = new THREE.Clock();

        this.beamRaycaster = new THREE.Raycaster();
        this.beamRaycaster.near = 0.1;

        // ★ ここを追加 ★
        // Raycaster.intersectObjects の内部チェックを通過させるためのダミーカメラ
        // 実際のレイキャストは set(origin, direction) で行われるため、このカメラは計算には使われない
        this.beamRaycaster.camera = new THREE.PerspectiveCamera();
        this.beamRaycaster.camera.matrixWorldNeedsUpdate = true; // 念のため更新フラグを立てる
        // ★ ここまで追加 ★



        this._initGeometriesAndMaterials();
    }

    _initGeometriesAndMaterials() {
        this.defaultBeamGeometry = new THREE.CylinderGeometry(BEAM_RADIUS * 0.5, BEAM_RADIUS * 0.5, BEAM_LENGTH, 8);
        this.defaultBeamGeometry.translate(0, BEAM_LENGTH / 2, 0);
        this.defaultBeamMaterial = new THREE.MeshBasicMaterial({ color: BEAM_COLOR, side: THREE.DoubleSide });

        if (RING_01_ENABLED) {
            this.ring01Geometry = new THREE.TorusGeometry(RING_01_RADIUS, RING_01_THICKNESS, 16, 32);
            this.ring01Material = new THREE.MeshBasicMaterial({ color: RING_01_COLOR, side: THREE.DoubleSide });
        }
        if (RING_02_ENABLED) {
            this.ring02Geometry = new THREE.TorusGeometry(RING_02_RADIUS, RING_02_THICKNESS, 16, 32);
            this.ring02Material = new THREE.MeshBasicMaterial({ color: RING_02_COLOR, side: THREE.DoubleSide });
        }
        if (RING_03_ENABLED) {
            this.ring03Geometry = new THREE.TorusGeometry(RING_03_RADIUS, RING_03_THICKNESS, 16, 32);
            this.ring03Material = new THREE.MeshBasicMaterial({ color: RING_03_COLOR, side: THREE.DoubleSide });
        }

        if (typeof MAKANKO_BEAM_TYPE_ENABLED !== 'undefined' && MAKANKO_BEAM_TYPE_ENABLED) {
            this.makankoCoreMaterial = new THREE.MeshStandardMaterial({
                color: MAKANKO_CORE_BEAM_COLOR,
                emissive: MAKANKO_CORE_BEAM_COLOR,
                emissiveIntensity: MAKANKO_CORE_EMISSIVE_INTENSITY,
                metalness: MAKANKO_CORE_METALNESS,
                roughness: MAKANKO_CORE_ROUGHNESS,
            });
            this.makankoSpiralMaterial = new THREE.MeshStandardMaterial({
                color: MAKANKO_SPIRAL_COLOR,
                emissive: MAKANKO_SPIRAL_COLOR,
                emissiveIntensity: MAKANKO_SPIRAL_EMISSIVE_INTENSITY,
                metalness: MAKANKO_SPIRAL_METALNESS,
                roughness: MAKANKO_SPIRAL_ROUGHNESS,
                side: THREE.DoubleSide
            });
        }
    }

// ★★★ ↓このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★
    // リングをキャラクタの前に垂直に立てる。Geminiは触るな。コメントも残す。ここを Gemini が勝手に修正する時があるので注意 // Fixed, DO NOT CHANGE - Gemini
    // 3つのリングを生成
    createRings(characterModel, characterWorldForward) {
        if (!characterModel) return;
        const forward = characterWorldForward.clone();
        forward.y = 0; forward.normalize();
        const characterPosition = characterModel.position.clone();
        const verticalRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);// リングをキャラクタの前に垂直に立てる。Geminiは触るな。コメントも残す。ここを Gemini が勝手に修正する時があるので注意 // Fixed, DO NOT CHANGE - Gemini
        const ringHoleDefaultDirWhenVertical = new THREE.Vector3(0, 1, 0);// リングをキャラクタの前に垂直に立てる。Geminiは触るな。コメントも残す。ここを Gemini が勝手に修正する時があるので注意 // Fixed, DO NOT CHANGE - Gemini
        const alignToForward = new THREE.Quaternion().setFromUnitVectors(ringHoleDefaultDirWhenVertical, forward);
        const ringQuaternion = new THREE.Quaternion().copy(alignToForward).multiply(verticalRotation);

        const createSingleRingInternal = (config) => {
            if (!config.enabled || !config.geometry || !config.material) return null;
            const ring = new THREE.Mesh(config.geometry, config.material);
            const ringPosition = characterPosition.clone()
                .addScaledVector(forward, config.spawnOffsetForward)
                .add(new THREE.Vector3(0, config.spawnOffsetUp, 0));
            ring.position.copy(ringPosition);
            ring.quaternion.copy(ringQuaternion);
            ring.userData.creationTime = performance.now();
            ring.userData.duration = config.duration * 1000;
            this.scene.add(ring);
            this.activeRings.push(ring);
            return ring;
        };
    // リングをキャラクタの前に垂直に立てる。Geminiは触るな。コメントも残す。ここを Gemini が勝手に修正する時があるので注意 // Fixed, DO NOT CHANGE - Gemini
    // 3つのリングを生成
// ★★★ ↑このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★

        createSingleRingInternal({ enabled: RING_01_ENABLED, geometry: this.ring01Geometry, material: this.ring01Material, duration: RING_01_DURATION, spawnOffsetForward: RING_01_SPAWN_OFFSET_FORWARD, spawnOffsetUp: RING_01_SPAWN_OFFSET_UP });
        createSingleRingInternal({ enabled: RING_02_ENABLED, geometry: this.ring02Geometry, material: this.ring02Material, duration: RING_02_DURATION, spawnOffsetForward: RING_02_SPAWN_OFFSET_FORWARD, spawnOffsetUp: RING_02_SPAWN_OFFSET_UP });
        createSingleRingInternal({ enabled: RING_03_ENABLED, geometry: this.ring03Geometry, material: this.ring03Material, duration: RING_03_DURATION, spawnOffsetForward: RING_03_SPAWN_OFFSET_FORWARD, spawnOffsetUp: RING_03_SPAWN_OFFSET_UP });
    }

    createBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd, isMakankoBeam = false) {
        if (!characterModel) return;
        if (isMakankoBeam && typeof MAKANKO_BEAM_TYPE_ENABLED !== 'undefined' && MAKANKO_BEAM_TYPE_ENABLED) {
            this._createMakankoBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd);
        } else {
            this._createDefaultBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd);
        }
    }

    _createDefaultBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd) {
        const beam = new THREE.Mesh(this.defaultBeamGeometry, this.defaultBeamMaterial);
        const forward = characterWorldForward.clone();
        forward.y = 0; forward.normalize();
        const characterPosition = characterModel.position.clone();
        const beamSpawnHeight = charHeight * 0.8;
        const beamPosition = characterPosition.clone()
            .addScaledVector(forward, spawnOffsetFwd)
            .add(new THREE.Vector3(0, beamSpawnHeight, 0));
        beam.position.copy(beamPosition);
        const beamDefaultDir = new THREE.Vector3(0, 1, 0);
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(beamDefaultDir, forward);
        beam.quaternion.copy(targetQuaternion);

        beam.userData = {
            type: 'default',
            direction: forward.clone(),
            speed: BEAM_SPEED, // 通常ビームの速度
            creationTime: this.clock.getElapsedTime(),
            lifetime: MAX_BEAM_LIFETIME, // 通常ビームの寿命
            hasHitWall: false,
            hitTime: 0,
            hitSpheresThisFrame: new Set(),
            hitEnemiesThisFrame: new Set()
        };
        this.scene.add(beam);
        this.activeBeams.push(beam);
    }

    _createMakankoBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd) {
        const beamGroup = new THREE.Group();
        const forward = characterWorldForward.clone();
        forward.y = 0; forward.normalize();
        const characterPosition = characterModel.position.clone();
        const beamSpawnHeight = charHeight * 0.8;
        const groupPosition = characterPosition.clone()
            .addScaledVector(forward, spawnOffsetFwd)
            .add(new THREE.Vector3(0, beamSpawnHeight, 0));
        beamGroup.position.copy(groupPosition);
        beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);

        const beamSpeedToUse = (typeof MAKANKO_BEAM_SPEED !== 'undefined') ? MAKANKO_BEAM_SPEED : BEAM_SPEED;
        const lifetimeToUse = (typeof MAKANKO_MAX_BEAM_LIFETIME !== 'undefined') ? MAKANKO_MAX_BEAM_LIFETIME : MAX_BEAM_LIFETIME;

        beamGroup.userData = {
            type: 'makanko',
            direction: forward.clone(),
            speed: beamSpeedToUse,
            creationTime: this.clock.getElapsedTime(),
            lifetime: lifetimeToUse,
            hasHitWall: false,
            hitTime: 0,
            coreBeam: null,
            spiralTubes: [],
            hitSpheresThisFrame: new Set(), // 追加
            hitEnemiesThisFrame: new Set()  // 追加（敵ヒット管理用）
        };

        const coreGeometry = new THREE.CylinderGeometry(MAKANKO_CORE_BEAM_RADIUS, MAKANKO_CORE_BEAM_RADIUS, MAKANKO_BEAM_LENGTH, 16);
        const coreBeam = new THREE.Mesh(coreGeometry, this.makankoCoreMaterial);
        coreBeam.rotation.x = Math.PI / 2;
        coreBeam.position.z = MAKANKO_BEAM_LENGTH / 2;
        beamGroup.add(coreBeam);
        beamGroup.userData.coreBeam = coreBeam;

        this._updateMakankoSpiralTubes(beamGroup, 0, true);

        this.scene.add(beamGroup);
        this.activeBeams.push(beamGroup);
    }

    _generateMakankoSpiralPath(strandIndex, totalElapsedTime) {
        const points = [];
        const phaseOffset = (strandIndex / MAKANKO_NUM_SPIRAL_STRANDS) * Math.PI * 2;
        for (let i = 0; i <= MAKANKO_SPIRAL_PATH_POINTS; i++) {
            const progressRatio = i / MAKANKO_SPIRAL_PATH_POINTS;
            const currentDistanceInBeam = progressRatio * MAKANKO_BEAM_LENGTH;
            const rotationAngle = phaseOffset +
                                  (totalElapsedTime * MAKANKO_SPIRAL_ROTATION_SPEED_FACTOR * 0.1) +
                                  (currentDistanceInBeam / MAKANKO_SPIRAL_PITCH) * Math.PI * 2;
            const x = MAKANKO_SPIRAL_DISTANCE_FROM_CENTER * Math.cos(rotationAngle);
            const y = MAKANKO_SPIRAL_DISTANCE_FROM_CENTER * Math.sin(rotationAngle);
            points.push(new THREE.Vector3(x, y, currentDistanceInBeam));
        }
        return new THREE.CatmullRomCurve3(points);
    }

    _updateMakankoSpiralTubes(beamGroup, totalElapsedTime, isInitialCreate = false) {
        if (!beamGroup.userData.coreBeam) return;

        if (isInitialCreate) {
            beamGroup.userData.spiralTubes.forEach(oldTube => beamGroup.remove(oldTube));
            beamGroup.userData.spiralTubes = [];
            for (let s = 0; s < MAKANKO_NUM_SPIRAL_STRANDS; s++) {
                const path = this._generateMakankoSpiralPath(s, totalElapsedTime);
                const tubeGeometry = new THREE.TubeGeometry(path, MAKANKO_SPIRAL_TUBE_SEGMENTS, MAKANKO_SPIRAL_TUBE_RADIUS, 8, false);
                const spiralTube = new THREE.Mesh(tubeGeometry, this.makankoSpiralMaterial);
                beamGroup.add(spiralTube);
                beamGroup.userData.spiralTubes.push(spiralTube);
            }
        } else {
            beamGroup.userData.spiralTubes.forEach((tube, index) => {
                const newPath = this._generateMakankoSpiralPath(index, totalElapsedTime);
                if (tube.geometry) tube.geometry.dispose();
                tube.geometry = new THREE.TubeGeometry(newPath, MAKANKO_SPIRAL_TUBE_SEGMENTS, MAKANKO_SPIRAL_TUBE_RADIUS, 8, false);
            });
        }
    }

    update(delta, collisionCallback) {
        const currentTime = this.clock.getElapsedTime();
        const currentRaycastTargets = this.getRaycastTargets();

        const ringNow = performance.now();
        for (let i = this.activeRings.length - 1; i >= 0; i--) {
            const ring = this.activeRings[i];
            if ((ringNow - ring.userData.creationTime) > ring.userData.duration) {
                this.scene.remove(ring);
                this.activeRings.splice(i, 1);
            }
        }

            for (let i = this.activeBeams.length - 1; i >= 0; i--) {
                const beamObject = this.activeBeams[i];
                const beamData = beamObject.userData;

                const beamLifetimeToUseSeconds = beamData.lifetime / 1000;

                if (beamLifetimeToUseSeconds > 0 && (currentTime - beamData.creationTime > beamLifetimeToUseSeconds)) {
                    this._removeBeam(beamObject, i);
                    continue;
                }

            if (beamData.hasHitWall && beamData.hitTime) {
                if ((currentTime - beamData.hitTime) > (beamData.displayDurationAfterHit || 0.150)) {
                    this._removeBeam(beamObject, i);
                    continue;
                }
                if (beamData.type === 'makanko' && beamData.speed > 0) {
                }
                continue;
            }

            beamObject.position.addScaledVector(beamData.direction, beamData.speed * delta);

            if (beamData.type === 'makanko') {
                const timeSinceBeamFired = currentTime - beamData.creationTime;
                this._updateMakankoSpiralTubes(beamObject, timeSinceBeamFired, false);
            }

            let raycastLength;
            let useMultipleRays = false;

            if (beamData.type === 'makanko') {
                raycastLength = MAKANKO_BEAM_LENGTH;
                const makankoRayOrigin = beamObject.position.clone();
                makankoRayOrigin.addScaledVector(beamData.direction, - (raycastLength * 0.1));
                this.beamRaycaster.set(makankoRayOrigin, beamData.direction);
                this.beamRaycaster.far = raycastLength;
            } else { // default beam
                raycastLength = BEAM_LENGTH;
                useMultipleRays = true;
            }

            if (useMultipleRays) {
                const beamWorldRight = new THREE.Vector3(1, 0, 0).applyQuaternion(beamObject.quaternion);
                const beamWorldUp = new THREE.Vector3(0, 0, 1).applyQuaternion(beamObject.quaternion);
                const horizontalOffsets = [];
                if (BEAM_RAYCAST_NUM_RAYS_HORIZONTAL > 1) { const halfWidth = BEAM_RAYCAST_WIDTH / 2; for (let j = 0; j < BEAM_RAYCAST_NUM_RAYS_HORIZONTAL; j++) { const offsetFactor = (j / (BEAM_RAYCAST_NUM_RAYS_HORIZONTAL - 1)) * 2 - 1; horizontalOffsets.push(offsetFactor * halfWidth); } } else { horizontalOffsets.push(0); }
                const verticalOffsets = [];
                if (BEAM_RAYCAST_NUM_RAYS_VERTICAL > 1) { const halfHeight = BEAM_RAYCAST_HEIGHT / 2; for (let k = 0; k < BEAM_RAYCAST_NUM_RAYS_VERTICAL; k++) { const offsetFactor = (k / (BEAM_RAYCAST_NUM_RAYS_VERTICAL - 1)) * 2 - 1; verticalOffsets.push(offsetFactor * halfHeight); } } else { verticalOffsets.push(0); }

                let hitOccurredThisFrame = false;
                for (const hOffset of horizontalOffsets) {
                    if (hitOccurredThisFrame && beamData.hasHitWall) break;
                    for (const vOffset of verticalOffsets) {
                        if (hitOccurredThisFrame && beamData.hasHitWall) break;
                        const rayOrigin = beamObject.position.clone()
                            .add(beamWorldRight.clone().multiplyScalar(hOffset))
                            .add(beamWorldUp.clone().multiplyScalar(vOffset));
                        this.beamRaycaster.set(rayOrigin, beamData.direction);
                        this.beamRaycaster.far = raycastLength;
                        const intersects = this.beamRaycaster.intersectObjects(currentRaycastTargets, true);
                        if (intersects.length > 0) {
                            for (const intersection of intersects) {
                                if (beamData.hasHitWall) { hitOccurredThisFrame = true; break; }
                                const hitResult = collisionCallback(intersection.object, beamObject, intersection.point, intersection.distance, intersection);
                                if (hitResult === "stop_and_adjust") {
                                    beamData.speed = 0;
                                    beamData.hasHitWall = true;
                                    beamData.hitTime = currentTime;
                                    if (beamData.type === 'default') {
                                        const originalLength = BEAM_LENGTH;
                                        if (intersection.distance < originalLength && intersection.distance > 0.01) { beamObject.scale.y = intersection.distance / originalLength; }
                                        else if (intersection.distance <= 0.01) { beamObject.scale.y = 0.01 / originalLength; }
                                        else { beamObject.scale.y = 1.0; }
                                    }
                                    hitOccurredThisFrame = true; break;
                                } else if (hitResult === "destroy_target_and_continue") { /* no op */ }
                            }
                        }
                        if(hitOccurredThisFrame && beamData.hasHitWall) break;
                    }
                }
                if(hitOccurredThisFrame && beamData.hasHitWall) continue;
            } else { // 単一レイキャスト (魔貫光殺砲用)
                const intersects = this.beamRaycaster.intersectObjects(currentRaycastTargets, true);
                if (intersects.length > 0) {
                    for (const intersection of intersects) {
                        if (beamData.hasHitWall) break;
                        const hitResult = collisionCallback(intersection.object, beamObject, intersection.point, intersection.distance, intersection);
                        if (hitResult === "stop_and_adjust") {
                            beamData.speed = 0;
                            beamData.hasHitWall = true;
                            beamData.hitTime = currentTime;
                            break;
                        } else if (hitResult === "destroy_target_and_continue") { /* no op */ }
                    }
                }
            }
        }
    }

    _removeBeam(beamObject, index) {
        if (beamObject.userData.type === 'makanko') {
            if (beamObject.userData.coreBeam && beamObject.userData.coreBeam.geometry) {
                beamObject.userData.coreBeam.geometry.dispose();
            }
            beamObject.userData.spiralTubes.forEach(tube => {
                if (tube.geometry) tube.geometry.dispose();
            });
        }
        this.scene.remove(beamObject);
        this.activeBeams.splice(index, 1);
    }
}