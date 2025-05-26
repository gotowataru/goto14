// EnemyManager.js
import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {
    ENEMY_001_NUM_INSTANCES, ENEMY_001_MODEL_PATH, ENEMY_001_ANIMATIONS,
    ENEMY_001_INITIAL_POSITIONS, ENEMY_001_SCALE,
    // BASE_HEIGHT, BASE_RADIUS は直接 EnemyManager では使わないので削除
    ENEMY_001_HEIGHT, ENEMY_001_RADIUS, ENEMY_001_MASS,
    ENEMY_001_FRICTION, ENEMY_001_RESTITUTION, ENEMY_001_HP, ENEMY_001_ATTACK_DAMAGE,
    ENEMY_001_LOCAL_FORWARD
    // ★ ENEMY_001_COMPOUND_SHAPE_DETAILS は constants.js から削除されたため、ここでもインポートしない
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
        this.loadedEnemyAssets = {};
    }

    async initEnemyAssets(allLoadedAssets) {
        if (allLoadedAssets.enemies) {
            for (const enemyKey in allLoadedAssets.enemies) {
                if (allLoadedAssets.enemies[enemyKey] && allLoadedAssets.enemies[enemyKey].model) {
                    this.loadedEnemyAssets[enemyKey] = {
                        modelPrototype: allLoadedAssets.enemies[enemyKey].model,
                        animations: allLoadedAssets.enemies[enemyKey].animations || {}
                    };
                    console.log(`EnemyManager: Asset for '${enemyKey}' loaded and registered.`);
                } else {
                    console.warn(`EnemyManager: Model for enemy type '${enemyKey}' not found in loaded assets.`);
                }
            }
        } else {
            console.warn("EnemyManager: No 'enemies' property found in allLoadedAssets.");
        }
    }

    /**
     * 指定された敵タイプのコンフィグオブジェクトを返します。
     * @param {string} enemyKey - 敵の識別キー (例: 'enemy_001')
     * @returns {object | null} 敵のコンフィグオブジェクト、またはnull
     */
    getEnemyTypeConfig(enemyKey) {
        // 将来的に複数の敵タイプをここに追加可能
        if (enemyKey === 'enemy_001') {
            return {
                KEY: 'enemy_001',
                NUM_INSTANCES: ENEMY_001_NUM_INSTANCES,
                MODEL_PATH: ENEMY_001_MODEL_PATH,
                INITIAL_POSITIONS: ENEMY_001_INITIAL_POSITIONS,
                SCALE: ENEMY_001_SCALE,
                // 物理ボディの作成時にこれらの全体設定が利用される
                HEIGHT: ENEMY_001_HEIGHT,
                RADIUS: ENEMY_001_RADIUS,
                MASS: ENEMY_001_MASS,
                FRICTION: ENEMY_001_FRICTION,
                RESTITUTION: ENEMY_001_RESTITUTION,
                HP: ENEMY_001_HP,
                ATTACK_DAMAGE: ENEMY_001_ATTACK_DAMAGE,
                LOCAL_FORWARD: ENEMY_001_LOCAL_FORWARD,
                // ★ COMPOUND_SHAPE_DETAILS は constants.js から削除されたため、ここでも含まない
            };
        }
        console.error(`EnemyManager: Config for unknown enemy type "${enemyKey}" requested.`);
        return null;
    }

    /**
     * 指定されたタイプの敵インスタンスを生成し、管理します。
     * @param {string} enemyKey - 生成する敵の識別キー (例: 'enemy_001')
     */
    createEnemiesOfType(enemyKey) {
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

        const numToCreate = enemyConfig.NUM_INSTANCES;
        if (numToCreate <= 0) {
            console.log(`EnemyManager: No instances to create for '${enemyKey}' (NUM_INSTANCES is 0 or less).`);
            return;
        }

        for (let i = 0; i < numToCreate; i++) {
            let modelInstance;
            // SkeletonUtils.clone を使用して、アニメーションと骨格構造を保持したままモデルをクローン
            if (typeof SkeletonUtils.clone === 'function') {
                modelInstance = SkeletonUtils.clone(assets.modelPrototype);
            } else {
                console.warn("EnemyManager: SkeletonUtils.clone is not available. Falling back to basic model.clone(). This might not work correctly for skinned meshes.");
                modelInstance = assets.modelPrototype.clone();
            }

            // Enemyコンストラクタには、HEIGHT, RADIUS, MASSなどの個別の物理設定がconfigオブジェクトに含まれている
            const enemy = new Enemy(enemyConfig, this.scene, this.physicsManager, this.effectManager, this.getPlayerReference);

            // 初期位置設定
            if (enemyConfig.INITIAL_POSITIONS && enemyConfig.INITIAL_POSITIONS[i]) {
                modelInstance.position.copy(enemyConfig.INITIAL_POSITIONS[i]);
            } else {
                console.warn(`EnemyManager: Initial position for '${enemyKey}' instance ${i} not defined or exhausted. Placing at (0,0,0).`);
                modelInstance.position.set(0, 0, 0); // デフォルト位置
            }

            // Enemyインスタンスの初期化
            enemy.init(modelInstance, assets.animations); // Enemy.jsのinitでconfigからHEIGHT, RADIUS, MASSを使用
            enemy.onAnimationFinishedCallback = this.handleEnemyAnimationFinished.bind(this);

            this.enemies.push(enemy);

            // ★ レイキャストターゲットに enemy.model (THREE.Group) を追加 ★
            // ProjectileManagerが recursive: true でレイキャストを行うため、
            // enemy.model (Group) を追加することで、その中の全ての子孫メッシュがヒット対象となる。
            // これにより、Blenderで「Enemy_」から始まる全てのメッシュがヒット判定対象になる
            if (enemy.model) {
                this.raycastTargetsRef.push(enemy.model);
                console.log(`EnemyManager: Added enemy.model (Group) of '${enemy.config.KEY}' to raycast targets.`);
            } else {
                console.warn(`EnemyManager: enemy.model not available for enemy '${enemy.config.KEY}'. Cannot add to raycast targets.`);
            }
        }
        console.log(`EnemyManager: Successfully created ${numToCreate} instances of '${enemyKey}'. Total enemies: ${this.enemies.length}`);
    }

    handleEnemyAnimationFinished(finishedActionName, enemyInstance) {
        if (finishedActionName === 'attack' && enemyInstance.isAlive) {
            if (enemyInstance.currentActionName === 'attack') {
                enemyInstance.switchAnimation('idle');
            }
        }
    }

    update(delta) {
        const tempTransform = this.physicsManager.getTempTransform();

        // 敵の更新と物理同期
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isAlive) {
                enemy.update(delta); // AIロジックやアニメーションの更新
                if (enemy.physicsBody && tempTransform) {
                    enemy.syncPhysicsToModel(tempTransform); // 物理ボディとThree.jsモデルの同期
                }
            } else {
                this.removeEnemy(enemy, i);
            }
        }
    }

    /**
     * 指定された敵インスタンスをシーンと物理ワールドから削除します。
     * @param {Enemy} enemy - 削除するEnemyインスタンス
     * @param {number} index - enemies配列内でのインデックス
     */
    removeEnemy(enemy, index) {
        // 物理ボディをワールドから削除
        if (enemy.physicsBody) {
            this.physicsManager.removeRigidBody(enemy.physicsBody);
            enemy.physicsBody = null; // 参照をクリア
        }

        // ★ レイキャストターゲットから enemy.model (THREE.Group) を削除 ★
        let targetToRemove = enemy.model; // enemy.model (Group) を削除対象とする
        const modelIndexInRaycast = this.raycastTargetsRef.indexOf(targetToRemove);
        if (modelIndexInRaycast !== -1) {
            this.raycastTargetsRef.splice(modelIndexInRaycast, 1);
            console.log(`EnemyManager: Removed enemy.model (Group) of '${enemy.config.KEY}' from raycast targets.`);
        } else {
             console.warn(`EnemyManager: Could not find enemy.model for '${enemy.config.KEY}' in raycastTargetsRef for removal.`);
        }

        // Enemyインスタンスのリソースを解放
        enemy.dispose();
        // 管理配列から削除
        this.enemies.splice(index, 1);
        console.log(`EnemyManager: Enemy '${enemy.config.KEY}' removed. Remaining enemies: ${this.enemies.length}`);
    }

    /**
     * 指定されたThree.jsオブジェクトが管理下の敵のモデル（グループ）またはその子孫メッシュである場合、
     * その敵インスタンスを返します。
     * ProjectileManagerが recursive: true でレイキャストを行う場合に、
     * ヒットした子メッシュから親の敵インスタンスを特定するために使用します。
     * @param {THREE.Object3D} object - 衝突した可能性のあるThree.jsオブジェクト (Group, Meshなど)
     * @returns {Enemy | null} 該当する敵インスタンス、またはnull
     */
    getEnemyByMesh(object) {
        // まず、直接enemy.model自体が渡された場合をチェック
        for (const enemy of this.enemies) {
            if (enemy.model === object) {
                return enemy;
            }
        }

        // 次に、ヒットしたオブジェクトがenemy.modelの子孫メッシュである場合、親を辿ってチェック
        let currentObject = object;
        while (currentObject) {
            for (const enemy of this.enemies) {
                // ヒットしたオブジェクトの親が、いずれかの敵のモデルグループと一致するかどうかを確認
                if (enemy.model === currentObject) {
                    return enemy;
                }
            }
            currentObject = currentObject.parent; // 親を遡る
            // シーンのルートまで辿り着いたら終了
            if (currentObject === this.scene) break;
        }
        return null;
    }

    /**
     * 指定されたThree.jsオブジェクトが現在生きている敵のモデルまたはその子孫メッシュであるかどうかを判定します。
     * @param {THREE.Object3D} object - 判定するThree.jsオブジェクト
     * @returns {boolean} 生きている敵であればtrue、そうでなければfalse
     */
    isEnemy(object) {
        const enemy = this.getEnemyByMesh(object); // getEnemyByMesh を呼び出すことで、親を辿るロジックが適用される
        return enemy !== null && enemy.isAlive;
    }

    /**
     * 管理下の全ての敵を削除し、リソースを解放します。
     */
    destroyAllEnemies() {
        console.log("EnemyManager: Destroying all enemies...");
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.removeEnemy(this.enemies[i], i);
        }
        this.enemies = []; // 念のため空にする
        this.loadedEnemyAssets = {}; // ロード済みアセットもクリア (再初期化を想定)
        console.log("EnemyManager: All enemies destroyed.");
    }
}