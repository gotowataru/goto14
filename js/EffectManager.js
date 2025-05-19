// EffectManager.js
import * as THREE from 'three';
import {
    MAZE_SCALE,
    // --- 十字架エフェクト用定数をインポート ---
    RAMIEL_CROSS_EFFECT_ENABLED, RAMIEL_CROSS_HEIGHT, RAMIEL_CROSS_ARM_LENGTH,
    RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_COLOR, RAMIEL_CROSS_OPACITY,
    RAMIEL_CROSS_EMISSIVE_INTENSITY, RAMIEL_CROSS_DURATION,
    RAMIEL_CROSS_FADE_IN_DURATION, RAMIEL_CROSS_FADE_OUT_DURATION,
    RAMIEL_CROSS_Y_OFFSET
} from './constants.js';

// --- (壁衝突パーティクル用) ---
const IMPACT_PARTICLE_COUNT = 150;
const IMPACT_PARTICLE_LIFETIME = 0.4;
const IMPACT_PARTICLE_BASE_SPEED = 80 * (MAZE_SCALE || 1);
const IMPACT_PARTICLE_SPREAD = 3.5;
const IMPACT_PARTICLE_SIZE = 0.3 * (MAZE_SCALE || 1);
const IMPACT_PARTICLE_COLOR = 0xffcc66;
const IMPACT_GRAVITY_EFFECT = 9.8 * (MAZE_SCALE || 1) * 5;

// --- (火花用) ---
const SPARK_PARTICLE_COUNT = 40;
const SPARK_LIFETIME = 0.5; // 時間
const SPARK_BASE_SPEED = 150 * (MAZE_SCALE || 1);
const SPARK_SPREAD = 2.0;
const SPARK_SIZE = 1.0 * (MAZE_SCALE || 1); // 大きさ
// SPARK_COLOR は引数で受け取る

// --- (デブリ用) ---
const DEBRIS_COUNT = 32;
const DEBRIS_LIFETIME = 1.0; // 時間
const DEBRIS_BASE_SPEED = 70 * (MAZE_SCALE || 1);
const DEBRIS_SPREAD_XY = 1.8; // XY方向の広がり
const DEBRIS_SPREAD_Y_MIN = 0.4; // Y方向の最低初速係数
const DEBRIS_SPREAD_Y_MAX = 0.8; // Y方向の最高初速係数
const DEBRIS_BOX_SIZE = 1.0 * (MAZE_SCALE || 1); // 立方体の一辺の長さ(大きさ)
const DEBRIS_GRAVITY = 9.8 * (MAZE_SCALE || 1) * 10;
const DEBRIS_MAX_BOUNCES = 3;
const DEBRIS_RESTITUTION = 0.4; // 反発係数





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

        // 火花用マテリアル (ベース) - 色やサイズは生成時に調整
        this.sparkParticleBaseMaterial = new THREE.PointsMaterial({
            size: SPARK_SIZE, // 基本サイズ
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        // デブリ用のジオメトリとマテリアル (ベース)
        this.debrisGeometry = new THREE.BoxGeometry(DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE);
        this.debrisBaseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 });
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
            type: 'impact_particle', // タイプを明確に
            velocities: velocities,
            startTimes: startTimes,
            creationTime: performance.now(),
            lifetime: IMPACT_PARTICLE_LIFETIME // 個別の寿命をuserDataに持たせる
        };
        this.scene.add(particles);
        this.activeEffects.push(particles);
    }

    // 球体破壊時の火花エフェクト
    createSparkExplosion(position, color = 0xffdd88) {

     // console.log("EffectManager: createSparkExplosion called at", position);
     // console.log("EffectManager: createDebrisExplosion called at", position);

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        const startTimes = [];

        for (let i = 0; i < SPARK_PARTICLE_COUNT; i++) {
            vertices.push(position.x, position.y, position.z);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(SPARK_BASE_SPEED * (0.8 + Math.random() * 0.4));
            velocities.push(velocity);
            startTimes.push(performance.now());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const sparkMaterialInstance = this.sparkParticleBaseMaterial.clone();
        sparkMaterialInstance.color.set(color);
        // sparkMaterialInstance.size = SPARK_SIZE; // ベースマテリアルで設定済みなら不要

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
        debrisGroup.userData = {
            type: 'debris_container',
            creationTime: performance.now(),
            // グループ全体の寿命目安 (個々のデブリが消えたら自動的に消えるようにする)
        };

        for (let i = 0; i < DEBRIS_COUNT; i++) {
            const debrisMaterialInstance = this.debrisBaseMaterial.clone();
            debrisMaterialInstance.color.set(color);
            const debrisMesh = new THREE.Mesh(this.debrisGeometry, debrisMaterialInstance);
            debrisMesh.position.copy(position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY,
                (Math.random() * (DEBRIS_SPREAD_Y_MAX - DEBRIS_SPREAD_Y_MIN) + DEBRIS_SPREAD_Y_MIN) * DEBRIS_BASE_SPEED, // Y方向の初速を調整
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY
            );
            // Y以外の速度成分を正規化してからスケール
            const horizontalSpeed = DEBRIS_BASE_SPEED * (0.6 + Math.random() * 0.4);
            const horizontalDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
            velocity.x = horizontalDir.x * horizontalSpeed;
            velocity.z = horizontalDir.z * horizontalSpeed;


            debrisMesh.userData = {
                velocity: velocity,
                startTime: performance.now(), // 個々のデブリの生成（アニメーション開始）時間
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5
                ),
                bounces: 0,
                maxBounces: DEBRIS_MAX_BOUNCES,
                restitution: DEBRIS_RESTITUTION,
                lifetime: DEBRIS_LIFETIME // 個々のデブリの寿命
            };
            debrisGroup.add(debrisMesh);
        }
        this.scene.add(debrisGroup);
        this.activeEffects.push(debrisGroup);
    }

    // --- ここから十字架エフェクト生成メソッド ---
    createRamielCrossExplosion(position) {

        if (!RAMIEL_CROSS_EFFECT_ENABLED) {
            console.log("[EffectManager] createRamielCrossExplosion: SKIPPED (RAMIEL_CROSS_EFFECT_ENABLED is false)"); // ★ログ追加
            return;
        }

        console.log("[EffectManager] createRamielCrossExplosion: CALLED with position:", position.clone()); // ★ログ追加



        // 十字架のジオメトリを作成
        // 縦棒
        const verticalBarGeometry = new THREE.BoxGeometry(RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_HEIGHT, RAMIEL_CROSS_THICKNESS);
        // 横棒
        const horizontalBarGeometry = new THREE.BoxGeometry(RAMIEL_CROSS_ARM_LENGTH, RAMIEL_CROSS_THICKNESS, RAMIEL_CROSS_THICKNESS);

        // 十字架のマテリアル
        const crossMaterial = new THREE.MeshBasicMaterial({ // または MeshStandardMaterial で emissive を使う
            color: RAMIEL_CROSS_COLOR,
            transparent: true,
            opacity: 0, // 初期状態では透明 (フェードインのため)
            side: THREE.DoubleSide, // 裏面も描画
            // blending: THREE.AdditiveBlending, // 光っぽさを強調する場合
        });
        // もしMeshStandardMaterialを使うなら:
        // const crossMaterial = new THREE.MeshStandardMaterial({
        //     color: RAMIEL_CROSS_COLOR,
        //     emissive: RAMIEL_CROSS_COLOR,
        //     emissiveIntensity: RAMIEL_CROSS_EMISSIVE_INTENSITY,
        //     transparent: true,
        //     opacity: 0,
        //     metalness: 0.0,
        //     roughness: 0.8,
        // });


        const verticalBar = new THREE.Mesh(verticalBarGeometry, crossMaterial.clone()); // マテリアルは共有せずクローン
        const horizontalBar = new THREE.Mesh(horizontalBarGeometry, crossMaterial.clone());

        // 横棒を縦棒の適切な位置に配置 (例: 縦棒の上から1/3程度の位置)
        horizontalBar.position.y = RAMIEL_CROSS_HEIGHT / 2 - RAMIEL_CROSS_HEIGHT / 3; // 中心からのオフセット

        const crossGroup = new THREE.Group();
        crossGroup.add(verticalBar);
        crossGroup.add(horizontalBar);

        // 十字架全体の位置を設定 (地面に根本が来るようにオフセット調整)
        crossGroup.position.copy(position);
        crossGroup.position.y += RAMIEL_CROSS_Y_OFFSET; // 地面から生えるように調整 (定数で定義)
                                                       // (position が爆心地の地面であると仮定)


        // ★★★ 生成されたオブジェクトの情報をログに出力 ★★★
        console.log("[EffectManager] Cross Group CREATED. Initial world position:", crossGroup.getWorldPosition(new THREE.Vector3()));
        console.log("[EffectManager] Cross Group Children (vertical, horizontal):", verticalBar, horizontalBar);
        console.log("[EffectManager] Cross Group Material (example from verticalBar):", verticalBar.material);
        // ★★★ここまでログ追加★★★





        crossGroup.userData = {
            type: 'ramiel_cross_explosion',
            creationTime: performance.now(),
            lifetime: RAMIEL_CROSS_DURATION,
            fadeInDuration: RAMIEL_CROSS_FADE_IN_DURATION,
            fadeOutDuration: RAMIEL_CROSS_FADE_OUT_DURATION,
            verticalBar: verticalBar,       // 個別アクセス用
            horizontalBar: horizontalBar    // 個別アクセス用
        };

        this.scene.add(crossGroup);
        this.activeEffects.push(crossGroup);
        // console.log("Ramiel Cross Explosion created at:", crossGroup.position);
        console.log("[EffectManager] Cross Group ADDED to scene and activeEffects. Active effects count:", this.activeEffects.length); // ★ログ追加


    }
    // --- ここまで十字架エフェクト生成メソッド ---




    // 唯一の update メソッド
    update(delta) {
        const now = performance.now();
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            const effectUserData = effect.userData; // userDataを一度変数に入れると少し見やすくなります

            if (effectUserData.type === 'impact_particle' || effectUserData.type === 'spark_particle') {
                // --- ポイントベースのパーティクル処理 (壁衝突、火花) ---
                const positionsAttribute = effect.geometry.attributes.position;
                if (!positionsAttribute) {
                    this.activeEffects.splice(i, 1);
                    continue;
                }
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
                            velocities[j].y -= IMPACT_GRAVITY_EFFECT * delta;
                        }
                    }
                }
                positionsAttribute.needsUpdate = true;

                if (allParticlesInEffectExpired || (now - effectUserData.creationTime) / 1000 > effectLifetime + 0.1) {
                    this.scene.remove(effect);
                    if (effect.geometry) effect.geometry.dispose();
                    if (effect.material && effect.material.dispose && !this.isSharedMaterial(effect.material)) {
                        effect.material.dispose();
                    }
                    this.activeEffects.splice(i, 1);
                }

            } else if (effectUserData.type === 'debris_container') {
                // --- デブリグループの処理 ---
                let activeDebrisCount = 0;
                effect.children.forEach(debrisMesh => {
                    if (!debrisMesh.userData) return;

                    const debrisData = debrisMesh.userData;
                    const elapsedTime = (now - debrisData.startTime) / 1000;

                    if (elapsedTime < debrisData.lifetime && debrisMesh.visible) {
                        activeDebrisCount++;
                        debrisMesh.position.addScaledVector(debrisData.velocity, delta);
                        debrisData.velocity.y -= DEBRIS_GRAVITY * delta;

                        debrisMesh.rotation.x += debrisData.angularVelocity.x * delta;
                        debrisMesh.rotation.y += debrisData.angularVelocity.y * delta;
                        debrisMesh.rotation.z += debrisData.angularVelocity.z * delta;

                        const groundY = 0; // TODO: 地面の高さを適切に設定 (MazeFloorのYなどを使用)
                        const debrisBottomY = debrisMesh.position.y - DEBRIS_BOX_SIZE / 2; // DEBRIS_BOX_SIZE は定数

                        if (debrisBottomY <= groundY && debrisData.velocity.y < 0) {
                            if (debrisData.bounces < debrisData.maxBounces) {
                                debrisMesh.position.y = groundY + DEBRIS_BOX_SIZE / 2;
                                debrisData.velocity.y *= -debrisData.restitution;
                                debrisData.velocity.x *= 0.8;
                                debrisData.velocity.z *= 0.8;
                                debrisData.angularVelocity.multiplyScalar(0.7);
                                debrisData.bounces++;
                            } else {
                                debrisData.velocity.set(0, 0, 0);
                                debrisData.angularVelocity.set(0,0,0);
                                debrisMesh.position.y = groundY + DEBRIS_BOX_SIZE / 2 * 0.5;
                                debrisMesh.visible = false;
                            }
                        }
                    } else {
                        debrisMesh.visible = false;
                    }
                });

                if (activeDebrisCount === 0 || (now - effectUserData.creationTime) / 1000 > DEBRIS_LIFETIME + 2.0) {
                    effect.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material && child.material.dispose) child.material.dispose();
                    });
                    this.scene.remove(effect);
                    this.activeEffects.splice(i, 1);
                }

            } else if (effectUserData.type === 'ramiel_cross_explosion') {
                // --- Ramiel Cross の更新処理 ---
                const data = effectUserData; // effectUserData は effect.userData と同じ
                const elapsedTime = (now - data.creationTime) / 1000;
                let currentOpacity = 0;

                // ★★★ updateループに入っているかのログ (フレーム毎に出るので注意、確認後コメントアウト推奨) ★★★
                // console.log(`[EffectManager] Updating Ramiel Cross: elapsedTime=${elapsedTime.toFixed(2)}s`);

                if (elapsedTime < data.lifetime) {
                    // フェードイン処理
                    if (elapsedTime < data.fadeInDuration) {
                        currentOpacity = RAMIEL_CROSS_OPACITY * (elapsedTime / data.fadeInDuration);
                    }
                    // 表示中 (フェードアウト開始前)
                    else if (elapsedTime < data.lifetime - data.fadeOutDuration) {
                        currentOpacity = RAMIEL_CROSS_OPACITY;
                    }
                    // フェードアウト処理
                    else {
                        const fadeOutElapsedTime = elapsedTime - (data.lifetime - data.fadeOutDuration);
                        currentOpacity = RAMIEL_CROSS_OPACITY * (1.0 - fadeOutElapsedTime / data.fadeOutDuration);
                    }
                    currentOpacity = Math.max(0, Math.min(RAMIEL_CROSS_OPACITY, currentOpacity)); // 範囲内に収める

                    // ★★★ 計算された透明度と、オブジェクトの可視性、ワールド座標のログ ★★★
                    if (effect.children.length > 0 && effect.children[0].material) { // 最初の子供のマテリアルで代表
                        console.log(`[EffectManager] Ramiel Cross Update: elapsedTime=${elapsedTime.toFixed(2)}, currentOpacity=${currentOpacity.toFixed(2)}, visible=${effect.visible}, worldPos.y=${effect.getWorldPosition(new THREE.Vector3()).y.toFixed(2)}`);
                        if (currentOpacity > 0 && !effect.visible) {
                            console.warn("[EffectManager] Ramiel Cross has opacity > 0 but effect.visible is false!");
                        }
                        if (currentOpacity === 0 && effect.visible && elapsedTime > data.fadeInDuration) {
                             console.warn("[EffectManager] Ramiel Cross has opacity = 0 but effect.visible is true (after fade-in period).");
                        }
                    }
                    // ★★★ここまでログ追加★★★

                    // マテリアルの透明度を更新 (Group内の各メッシュに適用)
                    // また、透明度がほぼ0ならオブジェクト自体を非表示にすることも検討
                    const isEffectVisible = currentOpacity > 0.01; // 少し閾値を設ける
                    effect.visible = isEffectVisible; // グループ全体の可視性を設定

                    effect.children.forEach(childMesh => {
                        if (childMesh.material) {
                            childMesh.material.opacity = currentOpacity;
                        }
                        childMesh.visible = isEffectVisible; // 子要素の可視性も親に合わせる
                    });

                } else { // 寿命が尽きた
                    console.log("[EffectManager] Ramiel Cross LIFETIME EXPIRED. Removing."); // ★ログ追加
                    this.scene.remove(effect);
                    // ジオメトリとマテリアルの解放 (Group内の各子要素に対して行う)
                    effect.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material && child.material.dispose) child.material.dispose();
                    });
                    this.activeEffects.splice(i, 1);
                }
            }
        }
    }



    // 共有マテリアルかどうかを判定するヘルパー（PointsMaterialはクローンしない前提なら不要）
    isSharedMaterial(material) {
        return material === this.impactParticleMaterial || material === this.sparkParticleBaseMaterial || material === this.debrisBaseMaterial;
    }
}