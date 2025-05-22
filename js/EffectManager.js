// EffectManager.js
import * as THREE from 'three';
import {
    MAZE_SCALE, // 壁衝突、火花、デブリの定数で使用
    // --- 十字架エフェクト用定数 ---
    RAMIEL_CROSS_EFFECT_ENABLED, RAMIEL_CROSS_HEIGHT, RAMIEL_CROSS_ARM_LENGTH,
    RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_COLOR, RAMIEL_CROSS_OPACITY,
    RAMIEL_CROSS_EMISSIVE_INTENSITY, RAMIEL_CROSS_DURATION,
    RAMIEL_CROSS_FADE_IN_DURATION, RAMIEL_CROSS_FADE_OUT_DURATION,
    RAMIEL_CROSS_Y_OFFSET,
    // --- ATフィールドエフェクト用定数 ---
    RAMIEL_AT_FIELD_ENABLED, RAMIEL_AT_FIELD_COLOR, RAMIEL_AT_FIELD_RADIUS,
    RAMIEL_AT_FIELD_INITIAL_OPACITY, RAMIEL_AT_FIELD_DURATION,
    RAMIEL_AT_FIELD_FADE_OUT_START_RATIO,
    RAMIEL_AT_FIELD_IS_WAVE_EFFECT, RAMIEL_AT_FIELD_WAVE_NUM_RINGS,
    RAMIEL_AT_FIELD_WAVE_RING_DURATION, RAMIEL_AT_FIELD_WAVE_SPAWN_INTERVAL,
    RAMIEL_AT_FIELD_WAVE_START_SCALE, RAMIEL_AT_FIELD_WAVE_END_SCALE_FACTOR,
    RAMIEL_AT_FIELD_WAVE_RING_THICKNESS_RATIO,
    RAMIEL_AT_FIELD_WAVE_FADE_OUT_START_RATIO_PER_RING,
    // RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL は Game.js で使用するためここでは不要
} from './constants.js';

// --- (壁衝突パーティクル用) ---
const IMPACT_PARTICLE_COUNT = 150;
const IMPACT_PARTICLE_LIFETIME = 0.4;
const IMPACT_PARTICLE_BASE_SPEED = 80 * (MAZE_SCALE || 1); // MAZE_SCALE を使用
const IMPACT_PARTICLE_SPREAD = 3.5;
const IMPACT_PARTICLE_SIZE = 0.3 * (MAZE_SCALE || 1);   // MAZE_SCALE を使用
const IMPACT_PARTICLE_COLOR = 0xffcc66;
const IMPACT_GRAVITY_EFFECT = 9.8 * (MAZE_SCALE || 1) * 5; // MAZE_SCALE を使用

// --- (火花用) ---
const SPARK_PARTICLE_COUNT = 40;
const SPARK_LIFETIME = 0.5;
const SPARK_BASE_SPEED = 150 * (MAZE_SCALE || 1); // MAZE_SCALE を使用
const SPARK_SPREAD = 2.0;
const SPARK_SIZE = 1.0 * (MAZE_SCALE || 1);     // MAZE_SCALE を使用
// SPARK_COLOR は引数で受け取る

// --- (デブリ用) ---
const DEBRIS_COUNT = 32;
const DEBRIS_LIFETIME = 1.0;
const DEBRIS_BASE_SPEED = 70 * (MAZE_SCALE || 1);  // MAZE_SCALE を使用
const DEBRIS_SPREAD_XY = 1.8;
const DEBRIS_SPREAD_Y_MIN = 0.4;
const DEBRIS_SPREAD_Y_MAX = 0.8;
const DEBRIS_BOX_SIZE = 1.0 * (MAZE_SCALE || 1); // MAZE_SCALE を使用
const DEBRIS_GRAVITY = 9.8 * (MAZE_SCALE || 1) * 10; // MAZE_SCALE を使用
const DEBRIS_MAX_BOUNCES = 3;
const DEBRIS_RESTITUTION = 0.4;


export class EffectManager {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];

        // 壁衝突パーティクル用マテリアル
        this.impactParticleMaterial = new THREE.PointsMaterial({
            color: IMPACT_PARTICLE_COLOR,
            size: IMPACT_PARTICLE_SIZE,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        // 火花用マテリアル (ベース)
        this.sparkParticleBaseMaterial = new THREE.PointsMaterial({
            size: SPARK_SIZE,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        // デブリ用のジオメトリとマテリアル (ベース)
        this.debrisGeometry = new THREE.BoxGeometry(DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE);
        this.debrisBaseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 });

        // ATフィールド用ジオメトリ
        if (RAMIEL_AT_FIELD_ENABLED && !RAMIEL_AT_FIELD_IS_WAVE_EFFECT) { 
             this.atFieldGeometry = new THREE.CircleGeometry(RAMIEL_AT_FIELD_RADIUS, 8);
        }
    }

    // 壁衝突時のエフェクト (パーティクル)
    createImpactEffect(position, normal) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        const startTimes = [];
        for (let i = 0; i < IMPACT_PARTICLE_COUNT; i++) {
            vertices.push(position.x, position.y, position.z);
            const velocity = normal.clone().negate();
            velocity.x += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.y += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.z += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.normalize().multiplyScalar(IMPACT_PARTICLE_BASE_SPEED * (0.7 + Math.random() * 0.6));
            velocities.push(velocity);
            startTimes.push(performance.now());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const particles = new THREE.Points(geometry, this.impactParticleMaterial);
        particles.userData = {
            type: 'impact_particle',
            velocities: velocities,
            startTimes: startTimes,
            creationTime: performance.now(),
            lifetime: IMPACT_PARTICLE_LIFETIME
        };
        this.scene.add(particles);
        this.activeEffects.push(particles);
    }

    // 球体破壊時の火花エフェクト
    createSparkExplosion(position, color = 0xffdd88) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        const startTimes = [];
        for (let i = 0; i < SPARK_PARTICLE_COUNT; i++) {
            vertices.push(position.x, position.y, position.z);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)
            ).normalize().multiplyScalar(SPARK_BASE_SPEED * (0.8 + Math.random() * 0.4));
            velocities.push(velocity);
            startTimes.push(performance.now());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const sparkMaterialInstance = this.sparkParticleBaseMaterial.clone();
        sparkMaterialInstance.color.set(color);
        const sparks = new THREE.Points(geometry, sparkMaterialInstance);
        sparks.userData = {
            type: 'spark_particle',
            velocities: velocities,
            startTimes: startTimes,
            creationTime: performance.now(),
            lifetime: SPARK_LIFETIME
        };
        this.scene.add(sparks);
        this.activeEffects.push(sparks);
    }

    // 球体破壊時のデブリ (破片) エフェクト
    createDebrisExplosion(position, color = 0x888888) {
        const debrisGroup = new THREE.Group();
        debrisGroup.userData = { type: 'debris_container', creationTime: performance.now() };
        for (let i = 0; i < DEBRIS_COUNT; i++) {
            const debrisMaterialInstance = this.debrisBaseMaterial.clone();
            debrisMaterialInstance.color.set(color);
            const debrisMesh = new THREE.Mesh(this.debrisGeometry, debrisMaterialInstance);
            debrisMesh.position.copy(position);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY,
                (Math.random() * (DEBRIS_SPREAD_Y_MAX - DEBRIS_SPREAD_Y_MIN) + DEBRIS_SPREAD_Y_MIN) * DEBRIS_BASE_SPEED,
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY
            );
            const horizontalSpeed = DEBRIS_BASE_SPEED * (0.6 + Math.random() * 0.4);
            const horizontalDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
            velocity.x = horizontalDir.x * horizontalSpeed;
            velocity.z = horizontalDir.z * horizontalSpeed;
            debrisMesh.userData = {
                velocity: velocity,
                startTime: performance.now(),
                angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
                bounces: 0,
                maxBounces: DEBRIS_MAX_BOUNCES,
                restitution: DEBRIS_RESTITUTION,
                lifetime: DEBRIS_LIFETIME
            };
            debrisGroup.add(debrisMesh);
        }
        this.scene.add(debrisGroup);
        this.activeEffects.push(debrisGroup);
    }

    // --- 十字架エフェクト生成メソッド ---
    createRamielCrossExplosion(position) {
        if (!RAMIEL_CROSS_EFFECT_ENABLED) return;
        const verticalBarGeometry = new THREE.BoxGeometry(RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_HEIGHT, RAMIEL_CROSS_THICKNESS);
        const horizontalBarGeometry = new THREE.BoxGeometry(RAMIEL_CROSS_ARM_LENGTH, RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_THICKNESS);
        const crossMaterial = new THREE.MeshBasicMaterial({
            color: RAMIEL_CROSS_COLOR, transparent: true, opacity: 0, side: THREE.DoubleSide
        });
        const verticalBar = new THREE.Mesh(verticalBarGeometry, crossMaterial.clone());
        const horizontalBar = new THREE.Mesh(horizontalBarGeometry, crossMaterial.clone());
        horizontalBar.position.y = RAMIEL_CROSS_HEIGHT / 2 - RAMIEL_CROSS_HEIGHT / 3;
        const crossGroup = new THREE.Group();
        crossGroup.add(verticalBar);
        crossGroup.add(horizontalBar);
        crossGroup.position.copy(position);
        crossGroup.position.y += RAMIEL_CROSS_Y_OFFSET;
        crossGroup.userData = {
            type: 'ramiel_cross_explosion',
            creationTime: performance.now(),
            lifetime: RAMIEL_CROSS_DURATION,
            fadeInDuration: RAMIEL_CROSS_FADE_IN_DURATION,
            fadeOutDuration: RAMIEL_CROSS_FADE_OUT_DURATION,
            verticalBar: verticalBar,
            horizontalBar: horizontalBar
        };
        this.scene.add(crossGroup);
        this.activeEffects.push(crossGroup);
    }

    // --- ATフィールド風エフェクト生成メソッド ---
    createRamielATFieldEffect(position, facingDirection, isVertical = false) {
        if (!RAMIEL_AT_FIELD_ENABLED) {
            return;
        }

        const now = performance.now();

        if (RAMIEL_AT_FIELD_IS_WAVE_EFFECT) {
            // --- 波紋エフェクトの生成 ---
            const effectGroup = new THREE.Group();
            effectGroup.position.copy(position);

            // 向き設定 ここのifブロックは、Geminiが勝手に修正する時があるので注意
            if (isVertical) {
                const meshNormal = new THREE.Vector3(0, 0, 1);
                const targetDirection = facingDirection.clone().normalize();
                targetDirection.y = 0; //ここは正しい。触るな。Geminiが勝手に修正する時があるので注意
                if (targetDirection.lengthSq() < 0.001) {
                    targetDirection.set(1, 0, 0); // フォールバック
                }
                targetDirection.normalize();
                effectGroup.quaternion.setFromUnitVectors(meshNormal, targetDirection);
            }

            const outerR = RAMIEL_AT_FIELD_RADIUS * RAMIEL_AT_FIELD_WAVE_END_SCALE_FACTOR;
            const innerR = outerR * (1 - RAMIEL_AT_FIELD_WAVE_RING_THICKNESS_RATIO);
            const baseRingGeometry = new THREE.RingGeometry(
                innerR, outerR,
                8, // thetaSegments (八角形)
                1, // phiSegments
                0, Math.PI * 2
            );

            for (let i = 0; i < RAMIEL_AT_FIELD_WAVE_NUM_RINGS; i++) {
                const material = new THREE.MeshBasicMaterial({
                    color: RAMIEL_AT_FIELD_COLOR,
                    transparent: true,
                    opacity: 0, // 初期は透明
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });

                const ringMesh = new THREE.Mesh(baseRingGeometry, material);
                // 初期スケールを適用
                ringMesh.scale.set(RAMIEL_AT_FIELD_WAVE_START_SCALE, RAMIEL_AT_FIELD_WAVE_START_SCALE, 1);

                ringMesh.userData = {
                    spawnTime: now + i * RAMIEL_AT_FIELD_WAVE_SPAWN_INTERVAL * 1000,
                    animationEndTime: now + (i * RAMIEL_AT_FIELD_WAVE_SPAWN_INTERVAL + RAMIEL_AT_FIELD_WAVE_RING_DURATION) * 1000,
                    isSpawned: false,
                    maxOpacity: RAMIEL_AT_FIELD_INITIAL_OPACITY,
                    targetScale: RAMIEL_AT_FIELD_WAVE_END_SCALE_FACTOR, // この値は使わないかも (baseRingGeometryが既にend_scaleで作られているため)
                    ringLifetimeMs: RAMIEL_AT_FIELD_WAVE_RING_DURATION * 1000,
                    fadeOutStartRatio: RAMIEL_AT_FIELD_WAVE_FADE_OUT_START_RATIO_PER_RING
                };
                effectGroup.add(ringMesh);
            }

            effectGroup.userData = {
                type: 'ramiel_at_field_wave', // 新しいエフェクトタイプ
                creationTime: now,
                // グループ全体の寿命は、最後のリングのアニメーション終了時刻
                overallEndTime: now + ((RAMIEL_AT_FIELD_WAVE_NUM_RINGS - 1) * RAMIEL_AT_FIELD_WAVE_SPAWN_INTERVAL + RAMIEL_AT_FIELD_WAVE_RING_DURATION) * 1000,
            };

            this.scene.add(effectGroup);
            this.activeEffects.push(effectGroup);

        } else {
            // --- 従来の単一板エフェクトの生成 ---
            if (!this.atFieldGeometry) { // 万が一、初期化されていなかった場合
                this.atFieldGeometry = new THREE.CircleGeometry(RAMIEL_AT_FIELD_RADIUS, 8);
            }
            const material = new THREE.MeshBasicMaterial({
                color: RAMIEL_AT_FIELD_COLOR,
                transparent: true,
                opacity: RAMIEL_AT_FIELD_INITIAL_OPACITY,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const atFieldMesh = new THREE.Mesh(this.atFieldGeometry, material);
            atFieldMesh.position.copy(position);
            if (isVertical) {
                const meshNormal = new THREE.Vector3(0, 0, 1);
                const targetDirection = facingDirection.clone().normalize();
                targetDirection.y = 0;
                if (targetDirection.lengthSq() < 0.001) { targetDirection.set(1, 0, 0); }
                targetDirection.normalize();
                atFieldMesh.quaternion.setFromUnitVectors(meshNormal, targetDirection);
            }
            atFieldMesh.userData = {
                type: 'ramiel_at_field', // 従来のタイプ
                creationTime: now,
                lifetime: RAMIEL_AT_FIELD_DURATION,
                initialOpacity: RAMIEL_AT_FIELD_INITIAL_OPACITY,
                fadeOutStartRatio: RAMIEL_AT_FIELD_FADE_OUT_START_RATIO,
            };
            this.scene.add(atFieldMesh);
            this.activeEffects.push(atFieldMesh);
        }
    }

    // 唯一の update メソッド
    update(delta) {
        const now = performance.now();
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            const effectUserData = effect.userData;

            if (effectUserData.type === 'impact_particle' || effectUserData.type === 'spark_particle') {
                const positionsAttribute = effect.geometry.attributes.position;
                if (!positionsAttribute) { this.activeEffects.splice(i, 1); continue; }
                const velocities = effectUserData.velocities;
                const startTimes = effectUserData.startTimes;
                const effectLifetime = effectUserData.lifetime;
                let allParticlesInEffectExpired = true;
                for (let j = 0; j < positionsAttribute.count; j++) {
                    const particleElapsedTime = (now - startTimes[j]) / 1000;
                    if (particleElapsedTime < effectLifetime) {
                        allParticlesInEffectExpired = false;
                        const currentX = positionsAttribute.getX(j);
                        const currentY = positionsAttribute.getY(j);
                        const currentZ = positionsAttribute.getZ(j);
                        positionsAttribute.setXYZ(j,
                            currentX + velocities[j].x * delta,
                            currentY + velocities[j].y * delta,
                            currentZ + velocities[j].z * delta
                        );
                        if (effectUserData.type === 'impact_particle') {
                            velocities[j].y -= IMPACT_GRAVITY_EFFECT * delta; // 定数 IMPACT_GRAVITY_EFFECT がスコープ内にあること
                        }
                    }
                }
                positionsAttribute.needsUpdate = true;
                if (allParticlesInEffectExpired || (now - effectUserData.creationTime) / 1000 > effectLifetime + 0.1) {
                    this.scene.remove(effect);
                    if (effect.geometry) effect.geometry.dispose();
                    // spark_particle はマテリアルをクローンしているので、isSharedMaterial チェックは不要
                    if (effect.material && effect.material.dispose && (effectUserData.type === 'impact_particle' && !this.isSharedMaterial(effect.material))) {
                        effect.material.dispose();
                    } else if (effect.material && effect.material.dispose && effectUserData.type === 'spark_particle'){
                         effect.material.dispose(); // sparkのマテリアルは毎回cloneなので常にdispose
                    }
                    this.activeEffects.splice(i, 1);
                }
            } else if (effectUserData.type === 'debris_container') {
                let activeDebrisCount = 0;
                effect.children.forEach(debrisMesh => {
                    if (!debrisMesh.userData) return;
                    const debrisData = debrisMesh.userData;
                    const elapsedTime = (now - debrisData.startTime) / 1000;
                    if (elapsedTime < debrisData.lifetime && debrisMesh.visible) {
                        activeDebrisCount++;
                        debrisMesh.position.addScaledVector(debrisData.velocity, delta);
                        debrisData.velocity.y -= DEBRIS_GRAVITY * delta; // 定数 DEBRIS_GRAVITY がスコープ内にあること
                        debrisMesh.rotation.x += debrisData.angularVelocity.x * delta;
                        debrisMesh.rotation.y += debrisData.angularVelocity.y * delta;
                        debrisMesh.rotation.z += debrisData.angularVelocity.z * delta;
                        const groundY = 0; // 地面のY座標 (必要に応じて調整)
                        const debrisBottomY = debrisMesh.position.y - (debrisMesh.geometry.parameters.height || DEBRIS_BOX_SIZE) / 2; // 定数 DEBRIS_BOX_SIZE
                        if (debrisBottomY <= groundY && debrisData.velocity.y < 0) {
                            if (debrisData.bounces < debrisData.maxBounces) {
                                debrisMesh.position.y = groundY + (debrisMesh.geometry.parameters.height || DEBRIS_BOX_SIZE) / 2;
                                debrisData.velocity.y *= -debrisData.restitution;
                                debrisData.velocity.x *= 0.8;
                                debrisData.velocity.z *= 0.8;
                                debrisData.angularVelocity.multiplyScalar(0.7);
                                debrisData.bounces++;
                            } else {
                                debrisData.velocity.set(0, 0, 0);
                                debrisData.angularVelocity.set(0,0,0);
                                debrisMesh.position.y = groundY + (debrisMesh.geometry.parameters.height || DEBRIS_BOX_SIZE) / 2 * 0.5;
                                debrisMesh.visible = false;
                            }
                        }
                    } else { debrisMesh.visible = false; }
                });
                if (activeDebrisCount === 0 && effect.children.length > 0) {
                    let allInvisible = true;
                    effect.children.forEach(child => { if (child.visible) allInvisible = false; });
                    if (allInvisible || (now - effectUserData.creationTime) / 1000 > (DEBRIS_LIFETIME + 2.0)) { // 定数 DEBRIS_LIFETIME
                        effect.children.forEach(child => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material && child.material.dispose) child.material.dispose();
                        });
                        this.scene.remove(effect);
                        this.activeEffects.splice(i, 1);
                    }
                } else if (activeDebrisCount === 0 && effect.children.length === 0) {
                    this.scene.remove(effect);
                    this.activeEffects.splice(i, 1);
                }
            } else if (effectUserData.type === 'ramiel_cross_explosion') {
                const data = effectUserData;
                const elapsedTime = (now - data.creationTime) / 1000;
                let currentOpacity = 0;
                if (elapsedTime < data.lifetime) { // data.lifetime (RAMIEL_CROSS_DURATION)
                    if (elapsedTime < data.fadeInDuration) { // data.fadeInDuration (RAMIEL_CROSS_FADE_IN_DURATION)
                        currentOpacity = RAMIEL_CROSS_OPACITY * (elapsedTime / data.fadeInDuration); // 定数 RAMIEL_CROSS_OPACITY
                    } else if (elapsedTime < data.lifetime - data.fadeOutDuration) { // data.fadeOutDuration (RAMIEL_CROSS_FADE_OUT_DURATION)
                        currentOpacity = RAMIEL_CROSS_OPACITY;
                    } else {
                        const fadeOutElapsedTime = elapsedTime - (data.lifetime - data.fadeOutDuration);
                        currentOpacity = RAMIEL_CROSS_OPACITY * (1.0 - fadeOutElapsedTime / data.fadeOutDuration);
                    }
                    currentOpacity = Math.max(0, Math.min(RAMIEL_CROSS_OPACITY, currentOpacity));
                    const isEffectVisible = currentOpacity > 0.01;
                    effect.visible = isEffectVisible;
                    effect.children.forEach(childMesh => {
                        if (childMesh.material) { childMesh.material.opacity = currentOpacity; }
                        childMesh.visible = isEffectVisible;
                    });
                } else {
                    this.scene.remove(effect);
                    effect.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material && child.material.dispose) child.material.dispose();
                    });
                    this.activeEffects.splice(i, 1);
                }
            }
            else if (effectUserData.type === 'ramiel_at_field_wave') {
                const groupData = effectUserData;
                let allRingsProcessedForThisFrame = true; // このフレームで全リングが処理済みか (寿命ではない)

                if (now > groupData.overallEndTime + 100) { // グループ全体の終了時刻 (バッファ込)
                    let baseGeoDisposed = false;
                    effect.children.forEach(ringMesh => {
                        if (ringMesh.geometry && !baseGeoDisposed) {
                             ringMesh.geometry.dispose(); // 共有ジオメトリなので一度だけ
                             baseGeoDisposed = true;
                        }
                        if (ringMesh.material) ringMesh.material.dispose();
                    });
                    this.scene.remove(effect);
                    this.activeEffects.splice(i, 1);
                    continue;
                }

                effect.children.forEach(ringMesh => {
                    const ringData = ringMesh.userData;

                    if (now < ringData.spawnTime) {
                        allRingsProcessedForThisFrame = false; // まだ出現していないリングがある
                        return; // このリングはまだ処理しない
                    }

                    // リングがまだアクティブ (寿命内) か、またはまだ一度もスポーンしていない場合
                    if (now < ringData.animationEndTime || !ringData.isSpawned) {
                         allRingsProcessedForThisFrame = false; // アクティブなリングがある

                        if (!ringData.isSpawned) {
                            // 初回出現時の処理
                            // ringMesh.material.opacity はアニメーションで設定されるので、ここでは直接設定しない
                            ringData.isSpawned = true;
                        }

                        const ringElapsedTimeMs = now - ringData.spawnTime;
                        // 0.0 (出現時) から 1.0 (寿命終了時) までの進捗
                        const ringLifeProgress = Math.min(1.0, ringElapsedTimeMs / ringData.ringLifetimeMs);

                        // スケールアニメーション
                        // RAMIEL_AT_FIELD_WAVE_START_SCALE から 1.0 へ
                        const currentScaleValue = RAMIEL_AT_FIELD_WAVE_START_SCALE +
                                               (1.0 - RAMIEL_AT_FIELD_WAVE_START_SCALE) * ringLifeProgress;
                        ringMesh.scale.set(currentScaleValue, currentScaleValue, 1);

                        // フェードアウトアニメーション
                        if (ringLifeProgress > ringData.fadeOutStartRatio) {
                            const fadeOutProgress = (ringLifeProgress - ringData.fadeOutStartRatio) / (1.0 - ringData.fadeOutStartRatio);
                            ringMesh.material.opacity = ringData.maxOpacity * (1.0 - Math.min(1.0, fadeOutProgress));
                        } else {
                            ringMesh.material.opacity = ringData.maxOpacity; // フェードアウト前は最大不透明度
                        }
                        ringMesh.visible = ringMesh.material.opacity > 0.01;

                    } else {
                        // リングの寿命が終了した場合
                        ringMesh.material.opacity = 0;
                        ringMesh.visible = false;
                    }
                });
                // グループ全体の削除は overallEndTime で行うので、ここでは個別のリングが全て完了しても何もしない

            } else if (effectUserData.type === 'ramiel_at_field') { // 従来の単一板エフェクト
                const elapsedTime = (now - effectUserData.creationTime) / 1000;
                const lifetime = effectUserData.lifetime; // RAMIEL_AT_FIELD_DURATION
                if (elapsedTime < lifetime) {
                    let currentOpacity = effectUserData.initialOpacity; // RAMIEL_AT_FIELD_INITIAL_OPACITY
                    const fadeOutStartTime = lifetime * effectUserData.fadeOutStartRatio; // RAMIEL_AT_FIELD_FADE_OUT_START_RATIO
                    const fadeOutDuration = lifetime * (1.0 - effectUserData.fadeOutStartRatio);

                    if (elapsedTime > fadeOutStartTime && fadeOutDuration > 0) {
                        const fadeProgress = Math.min(1.0, (elapsedTime - fadeOutStartTime) / fadeOutDuration);
                        currentOpacity = effectUserData.initialOpacity * (1.0 - fadeProgress);
                    }
                    effect.material.opacity = Math.max(0, currentOpacity);
                    effect.visible = effect.material.opacity > 0.01;
                } else {
                    this.scene.remove(effect);
                    // 単一板のジオメトリが this.atFieldGeometry であり共有されている場合、disposeしない
                    if (effect.geometry && effect.geometry !== this.atFieldGeometry) {
                         effect.geometry.dispose();
                    }
                    if (effect.material && effect.material.dispose) { effect.material.dispose(); }
                    this.activeEffects.splice(i, 1);
                }
            }
        }
    }


    isSharedMaterial(material) {
        return material === this.impactParticleMaterial ||
               material === this.sparkParticleBaseMaterial ||
               material === this.debrisBaseMaterial;
    }
}