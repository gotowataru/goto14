// EnemyManager.js
import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// constants.js からインポートする定数
import {
    // Enemy_001 の基本設定 (モデルパス、アニメーション、物理特性など)
    // ENEMY_001_MODEL_PATH, ENEMY_001_ANIMATIONS, // これらは getEnemyTypeConfig 内で直接参照
    ENEMY_001_SCALE, // createEnemiesOfType で使用する可能性あり (AssetLoaderが設定しなかった場合など)
    ENEMY_001_HEIGHT, ENEMY_001_RADIUS, ENEMY_001_MASS,
    ENEMY_001_FRICTION, ENEMY_001_RESTITUTION, ENEMY_001_HP, ENEMY_001_ATTACK_DAMAGE,
    ENEMY_001_LOCAL_FORWARD,

    // Enemy_001 の新しいスポーン設定
    ENEMY_001_SPAWN_SETTINGS,

    // constants.js から直接参照するパス
    ENEMY_001_MODEL_PATH,
    ENEMY_001_ANIMATIONS

} from './constants.js';

export class EnemyManager {
    constructor(scene, physicsManager, effectManager, assetLoader, raycastTargetsRef, playerRefGetter) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.effectManager = effectManager;
        // this.assetLoader = assetLoader; // AssetLoader のインスタンスは Game.js が持ち、ここではロード済みアセットを受け取る
        this.raycastTargetsRef = raycastTargetsRef; // Game.js の raycastTargets 配列への参照
        this.getPlayerReference = playerRefGetter; // Game.js の character インスタンスを返すゲッター関数

        this.enemies = []; // 生成された Enemy インスタンスを管理する配列
        this.loadedEnemyAssets = {}; // Game.jsから渡された、ロード済みのアセットを保持
        // console.log("EnemyManager initialized.");
    }

    /**
     * Game.js の AssetLoader によってロードされた敵関連アセットを EnemyManager に登録します。
     * AssetLoader は loadedAssets.enemies[enemyKey] に
     * { model: loadedModel, animations: { animName: loadedClip } }
     * という構造で格納します。
     * @param {object} allLoadedAssets - AssetLoader.loadAll() の結果オブジェクト全体。
     */
    async initEnemyAssets(allLoadedAssets) {
        // 'enemy_001' のアセットを登録
        const enemyKey = 'enemy_001';
        if (allLoadedAssets.enemies && allLoadedAssets.enemies[enemyKey] && allLoadedAssets.enemies[enemyKey].model) {
            const enemyAssetData = allLoadedAssets.enemies[enemyKey]; // { model: ..., animations: ... }

            this.loadedEnemyAssets[enemyKey] = {
                modelPrototype: enemyAssetData.model,       // クローン元のモデル
                animations: enemyAssetData.animations || {} // アニメーションクリップのマップ
            };
            // console.log(`EnemyManager: Assets for '${enemyKey}' registered.`);
        } else {
            console.error(`EnemyManager: Assets for '${enemyKey}' (model or base structure) not found in allLoadedAssets.enemies. Cannot initialize ${enemyKey} assets.`);
        }

        // 将来的に enemy_002 などが増えた場合、同様にアセットを登録する処理を追加
        // const enemyKey002 = 'enemy_002';
        // if (allLoadedAssets.enemies && allLoadedAssets.enemies[enemyKey002] && ...) { ... }
    }


    /**
     * 指定された敵タイプのコンフィグオブジェクトを返します。
     * このコンフィグには、物理特性、スポーン設定などが含まれます。
     * @param {string} enemyKey - 敵の識別キー (例: 'enemy_001')
     * @returns {object | null} 敵のコンフィグオブジェクト、またはnull
     */
    getEnemyTypeConfig(enemyKey) {
        if (enemyKey === 'enemy_001') {
            return {
                KEY: 'enemy_001', // 敵タイプ識別子
                // --- スポーン設定 ---
                SPAWN_SETTINGS: ENEMY_001_SPAWN_SETTINGS,

                // --- 物理特性・基本ステータスなど (Enemyクラスが必要とするもの) ---
                SCALE: ENEMY_001_SCALE, // Enemyクラスが参照する可能性
                HEIGHT: ENEMY_001_HEIGHT,
                RADIUS: ENEMY_001_RADIUS,
                MASS: ENEMY_001_MASS,
                FRICTION: ENEMY_001_FRICTION,
                RESTITUTION: ENEMY_001_RESTITUTION,
                HP: ENEMY_001_HP,
                ATTACK_DAMAGE: ENEMY_001_ATTACK_DAMAGE,
                LOCAL_FORWARD: ENEMY_001_LOCAL_FORWARD,
                // 注意: Enemyクラスが必要とする他のパラメータがあればここに追加
            };
        }
        // 将来的に enemy_002 などが増えた場合、ここに追加
        // else if (enemyKey === 'enemy_002') { return { ... ENEMY_002_CONFIG_FROM_CONSTANTS ... }; }

        console.error(`EnemyManager: Config for unknown enemy type "${enemyKey}" requested.`);
        return null;
    }

    /**
     * 指定されたタイプの敵インスタンスを生成し、管理リストに追加します。
     * スポーン方法は、該当する敵タイプのコンフィグ内の SPAWN_SETTINGS.METHOD に基づきます。
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
            console.error(`EnemyManager: Failed to create enemies. Assets (model prototype) for type "${enemyKey}" not loaded or registered.`);
            return;
        }

        const spawnSettings = enemyConfig.SPAWN_SETTINGS;
        let numToCreate = 0;
        let positionsToUse = [];

        // スポーン方法に基づいて生成数と位置を決定
        if (spawnSettings.METHOD === 'FIXED') {
            if (!spawnSettings.INITIAL_POSITIONS || spawnSettings.INITIAL_POSITIONS.length === 0) {
                console.warn(`EnemyManager: For '${enemyKey}' with METHOD 'FIXED', INITIAL_POSITIONS is empty or not defined. No enemies will be created.`);
                return;
            }
            numToCreate = Math.min(spawnSettings.NUM_INSTANCES, spawnSettings.INITIAL_POSITIONS.length);
            if (spawnSettings.NUM_INSTANCES > spawnSettings.INITIAL_POSITIONS.length) {
                console.warn(`EnemyManager: For '${enemyKey}', NUM_INSTANCES in SPAWN_SETTINGS (${spawnSettings.NUM_INSTANCES}) is greater than available INITIAL_POSITIONS (${spawnSettings.INITIAL_POSITIONS.length}). Clamping to ${spawnSettings.INITIAL_POSITIONS.length} instances.`);
            }
            positionsToUse = spawnSettings.INITIAL_POSITIONS.slice(0, numToCreate);
        }
        // (将来用) 他のスポーンメソッド (RANDOM_IN_AREA など) の処理はここに追加
        // else if (spawnSettings.METHOD === 'RANDOM_IN_AREA') { ... }
        else {
            console.warn(`EnemyManager: Unsupported or unimplemented spawn METHOD '${spawnSettings.METHOD}' for '${enemyKey}'. No enemies will be created.`);
            return;
        }

        if (numToCreate <= 0) {
            // console.log(`EnemyManager: No instances to create for '${enemyKey}' based on current spawn settings.`);
            return;
        }

        // console.log(`EnemyManager: Attempting to create ${numToCreate} instances of '${enemyKey}'...`);

        for (let i = 0; i < numToCreate; i++) {
            let modelInstance;
            try {
                modelInstance = SkeletonUtils.clone(assets.modelPrototype);
                if (!modelInstance) throw new Error("SkeletonUtils.clone returned null or undefined.");
            } catch (error) {
                console.error(`EnemyManager: Error cloning model for '${enemyKey}' instance ${i}. Skipping this instance. Error:`, error);
                continue;
            }

            const enemy = new Enemy(enemyConfig, this.scene, this.physicsManager, this.effectManager, this.getPlayerReference);

            if (positionsToUse[i]) {
                modelInstance.position.copy(positionsToUse[i]);
            } else {
                console.warn(`EnemyManager: Initial position for '${enemyKey}' instance ${i} not defined. Placing at (0,1,0).`);
                modelInstance.position.set(0, 1, 0);
            }
            // AssetLoader側でスケール設定済みなので、ここでは通常不要。
            // ただし、AssetLoaderが設定しなかった場合のフォールバックや、
            // EnemyConfig側で上書きしたい場合に有効にするのはアリ。
            // modelInstance.scale.set(enemyConfig.SCALE, enemyConfig.SCALE, enemyConfig.SCALE);


            enemy.init(modelInstance, assets.animations); // assets.animations は { idle: AnimationClip, ... }
            enemy.onAnimationFinishedCallback = this.handleEnemyAnimationFinished.bind(this);

            this.enemies.push(enemy);

            if (enemy.model) {
                this.raycastTargetsRef.push(enemy.model);
            } else {
                console.warn(`EnemyManager: enemy.model not available after init for enemy '${enemy.config.KEY}'. Cannot add to raycast targets.`);
            }
        }
        // console.log(`EnemyManager: Successfully created ${this.enemies.filter(e => e.config.KEY === enemyKey).length} instances of '${enemyKey}'. Total enemies: ${this.enemies.length}`);
    }

    /**
     * 敵のアニメーションが終了したときに呼び出されるコールバック。
     * @param {string} finishedActionName - 終了したアニメーションアクションの名前
     * @param {Enemy} enemyInstance - アニメーションが終了した Enemy インスタンス
     */
    handleEnemyAnimationFinished(finishedActionName, enemyInstance) {
        if (finishedActionName === 'attack' && enemyInstance.isAlive) {
            if (enemyInstance.currentActionName === 'attack') {
                enemyInstance.switchAnimation('idle');
            }
        }
    }

    /**
     * ゲームループごとに呼び出され、管理下の全ての敵を更新します。
     * @param {number} delta - 前フレームからの経過時間 (秒)
     */
    update(delta) {
        const tempTransform = this.physicsManager.getTempTransform();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isAlive) {
                enemy.update(delta);
                if (enemy.physicsBody && tempTransform) {
                    enemy.syncPhysicsToModel(tempTransform);
                }
            } else {
                this.removeEnemy(enemy, i);
            }
        }
    }

    /**
     * 指定された敵インスタンスをシーン、物理ワールド、および管理リストから削除します。
     * @param {Enemy} enemy - 削除するEnemyインスタンス
     * @param {number} index - enemies配列内でのインデックス
     */
    removeEnemy(enemy, index) {
        // console.log(`EnemyManager: Removing enemy '${enemy.config.KEY}' (Instance ID: ${enemy.instanceId}).`);
        if (enemy.physicsBody) {
            this.physicsManager.removeRigidBody(enemy.physicsBody);
            enemy.physicsBody = null;
        }
        if (enemy.model) {
            const modelIndexInRaycast = this.raycastTargetsRef.indexOf(enemy.model);
            if (modelIndexInRaycast !== -1) {
                this.raycastTargetsRef.splice(modelIndexInRaycast, 1);
            }
        }
        enemy.dispose();
        this.enemies.splice(index, 1);
        // console.log(`EnemyManager: Enemy '${enemy.config.KEY}' (Instance ID: ${enemy.instanceId}) removed. Remaining enemies: ${this.enemies.length}`);
    }

    /**
     * 指定されたThree.jsオブジェクトが、管理下のいずれかの敵のモデル（THREE.Group）または
     * その子孫メッシュである場合、該当するEnemyインスタンスを返します。
     * @param {THREE.Object3D} object - 衝突した可能性のあるThree.jsオブジェクト
     * @returns {Enemy | null} 該当する敵インスタンス、またはnull
     */
    getEnemyByMesh(object) {
        if (!object) return null;
        let currentObject = object;
        while (currentObject) {
            for (const enemy of this.enemies) {
                if (enemy.model === currentObject) {
                    return enemy;
                }
            }
            if (!currentObject.parent || currentObject.parent === this.scene) {
                break;
            }
            currentObject = currentObject.parent;
        }
        return null;
    }

    /**
     * 指定されたThree.jsオブジェクトが、現在生きている敵のモデルまたはその子孫メッシュであるかどうかを判定します。
     * @param {THREE.Object3D} object - 判定するThree.jsオブジェクト
     * @returns {boolean} 生きている敵であればtrue、そうでなければfalse
     */
    isEnemy(object) {
        const enemy = this.getEnemyByMesh(object);
        return enemy !== null && enemy.isAlive;
    }

    /**
     * 管理下の全ての敵を削除し、リソースを解放します。ゲーム終了時などに使用。
     */
    destroyAllEnemies() {
        // console.log("EnemyManager: Destroying all enemies...");
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.removeEnemy(this.enemies[i], i);
        }
        this.enemies = [];
        this.loadedEnemyAssets = {};
        // console.log("EnemyManager: All enemies destroyed and assets cleared.");
    }
}