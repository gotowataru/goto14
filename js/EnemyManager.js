// EnemyManager.js
import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // ★ SkeletonUtils をインポート

import {
    // --- Enemy_001 設定をインポート ---
    ENEMY_001_NUM_INSTANCES, ENEMY_001_MODEL_PATH, ENEMY_001_ANIMATIONS,
    ENEMY_001_INITIAL_POSITIONS, ENEMY_001_SCALE, ENEMY_001_BASE_HEIGHT,
    ENEMY_001_BASE_RADIUS, ENEMY_001_HEIGHT, ENEMY_001_RADIUS, ENEMY_001_MASS,
    ENEMY_001_FRICTION, ENEMY_001_RESTITUTION, ENEMY_001_HP, ENEMY_001_ATTACK_DAMAGE,
    ENEMY_001_LOCAL_FORWARD
    // 他の敵タイプの設定も必要に応じてインポート
} from './constants.js';

export class EnemyManager {
    constructor(scene, physicsManager, effectManager, assetLoader, raycastTargetsRef, playerRefGetter) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.effectManager = effectManager;
        this.assetLoader = assetLoader;
        this.raycastTargetsRef = raycastTargetsRef;
        this.getPlayerReference = playerRefGetter;

        this.enemies = [];
        this.loadedEnemyAssets = {}; // { enemyKey: { modelPrototype, animations } }
        console.log("EnemyManager initialized.");
    }

    async initEnemyAssets(allLoadedAssets) {
        if (allLoadedAssets.enemies) {
            for (const enemyKey in allLoadedAssets.enemies) {
                if (allLoadedAssets.enemies[enemyKey] && allLoadedAssets.enemies[enemyKey].model) {
                    this.loadedEnemyAssets[enemyKey] = {
                        modelPrototype: allLoadedAssets.enemies[enemyKey].model,
                        animations: allLoadedAssets.enemies[enemyKey].animations || {} // アニメーションがない場合も考慮
                    };
                    console.log(`EnemyManager: Assets for enemy type '${enemyKey}' registered.`);
                } else {
                    console.warn(`EnemyManager: Model for enemy type '${enemyKey}' not found in loaded assets.`);
                }
            }
        } else {
            console.warn("EnemyManager: No 'enemies' property found in allLoadedAssets.");
        }
    }

    getEnemyTypeConfig(enemyKey) {
        // 将来的には、この部分をより動的にするか、設定ファイルから読み込む形にするのが望ましい
        if (enemyKey === 'enemy_001') {
            return {
                KEY: 'enemy_001',
                NUM_INSTANCES: ENEMY_001_NUM_INSTANCES,
                MODEL_PATH: ENEMY_001_MODEL_PATH, // constants.jsからの参照 (情報用)
                // ANIMATIONS: ENEMY_001_ANIMATIONS, // これはassetLoaderが読み込むので、ここでは不要かも
                INITIAL_POSITIONS: ENEMY_001_INITIAL_POSITIONS,
                SCALE: ENEMY_001_SCALE,
                BASE_HEIGHT: ENEMY_001_BASE_HEIGHT,
                BASE_RADIUS: ENEMY_001_BASE_RADIUS,
                HEIGHT: ENEMY_001_HEIGHT,
                RADIUS: ENEMY_001_RADIUS,
                MASS: ENEMY_001_MASS,
                FRICTION: ENEMY_001_FRICTION,
                RESTITUTION: ENEMY_001_RESTITUTION,
                HP: ENEMY_001_HP,
                ATTACK_DAMAGE: ENEMY_001_ATTACK_DAMAGE,
                LOCAL_FORWARD: ENEMY_001_LOCAL_FORWARD,
            };
        }
        // 他の敵タイプを追加する場合はここに `else if (enemyKey === 'enemy_002') { ... }` のように追加
        console.error(`EnemyManager: Config for unknown enemy type "${enemyKey}" requested.`);
        return null;
    }

    createEnemiesOfType(enemyKey) {
        console.log(`EnemyManager: Attempting to create enemies of type '${enemyKey}'.`);
        const enemyConfig = this.getEnemyTypeConfig(enemyKey);
        if (!enemyConfig) {
            console.error(`EnemyManager: Failed to create enemies. Config for type "${enemyKey}" not found.`);
            return;
        }

        const assets = this.loadedEnemyAssets[enemyKey];
        if (!assets || !assets.modelPrototype) {
            console.error(`EnemyManager: Failed to create enemies. Assets for type "${enemyKey}" (model prototype) not loaded.`);
            return;
        }
        console.log(`EnemyManager: Found assets for '${enemyKey}'. Model prototype:`, assets.modelPrototype);


        const numToCreate = enemyConfig.NUM_INSTANCES;
        console.log(`EnemyManager: Will create ${numToCreate} instance(s) of '${enemyKey}'.`);

        for (let i = 0; i < numToCreate; i++) {
            let modelInstance;
            // ★ SkeletonUtils.clone を直接使用
            if (typeof SkeletonUtils.clone === 'function') {
                modelInstance = SkeletonUtils.clone(assets.modelPrototype);
                console.log(`EnemyManager: Cloned model for '${enemyKey}' instance ${i} using SkeletonUtils.clone.`);
            } else {
                // この警告が出る場合は、SkeletonUtilsのインポートや利用方法に問題がある可能性
                console.warn("EnemyManager: SkeletonUtils.clone is not available. Falling back to basic model.clone(). This might not work correctly for skinned meshes.");
                modelInstance = assets.modelPrototype.clone();
            }

            const enemy = new Enemy(enemyConfig, this.scene, this.physicsManager, this.effectManager, this.getPlayerReference);

            if (enemyConfig.INITIAL_POSITIONS && enemyConfig.INITIAL_POSITIONS[i]) {
                modelInstance.position.copy(enemyConfig.INITIAL_POSITIONS[i]);
            } else {
                console.warn(`EnemyManager: Initial position for '${enemyKey}' instance ${i} not defined. Placing at default (0, height/2, 0).`);
                // Y座標は物理ボディの中心を考慮して設定するが、Enemy.jsの_createPhysicsBodyで調整される
                // ここではモデルの原点を基準に設定しておく (例: 足元が0になるように)
                modelInstance.position.set(0, 0, 0); // Enemy.init -> _createPhysicsBody で物理位置が決まる
                                                     // その後 syncPhysicsToModel でモデル位置が調整される
                                                     // なので、ここでのYは0でよく、物理ボディ生成時のinitialPosition.yで高さを決める
                if (enemyConfig.INITIAL_POSITIONS && enemyConfig.INITIAL_POSITIONS[0] && i >= enemyConfig.INITIAL_POSITIONS.length) {
                     console.warn(`EnemyManager: Not enough initial positions defined for ${numToCreate} instances of ${enemyKey}. Instance ${i} placed at default.`);
                }
            }

            // Enemyインスタンスを初期化 (モデルとアニメーションを渡す)
            // assets.animations は AssetLoader でロードされたアニメーションクリップのマップ
            enemy.init(modelInstance, assets.animations);
            enemy.onAnimationFinishedCallback = this.handleEnemyAnimationFinished.bind(this);

            this.enemies.push(enemy);
            if (enemy.model) {
                this.raycastTargetsRef.push(enemy.model); // 衝突判定対象に追加
            }
            console.log(`EnemyManager: Created '${enemyKey}' instance ${i + 1}/${numToCreate} at world position: x=${modelInstance.position.x.toFixed(1)}, y=${modelInstance.position.y.toFixed(1)}, z=${modelInstance.position.z.toFixed(1)}.`);
        }
        console.log(`EnemyManager: Creation complete for type '${enemyKey}'. Total active enemies: ${this.enemies.length}.`);
    }

    handleEnemyAnimationFinished(finishedActionName, enemyInstance) {
        // console.log(`EnemyManager: Animation '${finishedActionName}' finished for enemy '${enemyInstance.config.KEY}'.`);
        if (finishedActionName === 'attack' && enemyInstance.isAlive) {
            // 攻撃アニメーションが終わったら、次の行動（例：アイドルに戻る、再索敵など）をEnemy側で決定させる
            // enemyInstance.onAttackAnimationFinished(); // Enemyクラスにこのようなメソッドを持たせるなど
            if (enemyInstance.currentActionName === 'attack') { // まだ攻撃状態ならアイドルに戻すなど
                enemyInstance.switchAnimation('idle');
            }
        }
        // 他の特定のアニメーション終了時処理
    }

    update(delta) {
        const tempTransform = this.physicsManager.getTempTransform(); // 毎フレーム取得する
        if (!tempTransform) {
            // console.warn("EnemyManager.update: tempTransform is null. Skipping physics sync.");
            // PhysicsManagerが初期化途中などの場合に発生しうる
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isAlive) {
                enemy.update(delta); // AIやアニメーションの更新
                if (enemy.physicsBody && tempTransform) {
                    enemy.syncPhysicsToModel(tempTransform); // 物理状態をモデルに同期
                }
            } else {
                // isAliveがfalseになった敵のクリーンアップ処理
                console.log(`EnemyManager: Found dead enemy '${enemy.config.KEY}', preparing for removal.`);
                this.removeEnemy(enemy, i);
            }
        }
    }

    removeEnemy(enemy, index) {
        console.log(`EnemyManager: Removing enemy '${enemy.config.KEY}' at index ${index}.`);
        if (enemy.physicsBody) {
            this.physicsManager.removeRigidBody(enemy.physicsBody);
            enemy.physicsBody = null; // 参照をクリア
            console.log(`EnemyManager: Removed physics body for '${enemy.config.KEY}'.`);
        }

        const modelIndexInRaycast = this.raycastTargetsRef.indexOf(enemy.model);
        if (modelIndexInRaycast !== -1) {
            this.raycastTargetsRef.splice(modelIndexInRaycast, 1);
            console.log(`EnemyManager: Removed model of '${enemy.config.KEY}' from raycast targets.`);
        }

        enemy.dispose(); // Enemyインスタンス内のリソース解放 (モデルをシーンから削除など)
        this.enemies.splice(index, 1); // 管理リストから削除
        console.log(`EnemyManager: Enemy '${enemy.config.KEY}' fully removed. Remaining enemies: ${this.enemies.length}.`);
    }

    getEnemyByMesh(mesh) {
        for (const enemy of this.enemies) {
            if (enemy.model === mesh) {
                return enemy;
            }
        }
        return null;
    }

    isEnemy(object) {
        return this.enemies.some(e => e.model === object && e.isAlive);
    }

    destroyAllEnemies() {
        console.log("EnemyManager: Destroying all enemies...");
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.removeEnemy(this.enemies[i], i);
        }
        this.enemies = []; // 配列を空にする
        this.loadedEnemyAssets = {}; // ロード済みアセット情報もクリア
        console.log("EnemyManager: All enemies destroyed and resources cleared.");
    }
}