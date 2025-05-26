// Enemy.js
import * as THREE from 'three';

export class Enemy {
    constructor(config, scene, physicsManager, effectManager, playerRefGetter) {
        this.config = config; // EnemyManagerから渡された敵の設定オブジェクト全体を保持 (HEIGHT, RADIUS, MASSなどが含まれる)
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.effectManager = effectManager;
        this.getPlayerReference = playerRefGetter;

        this.model = null;
        this.mainMesh = null; // メインメッシュを保持するプロパティ
        this.mixer = null;
        this.actions = {};
        this.currentActionName = null;
        this.physicsBody = null;

        this.hp = this.config.HP;
        this.isAlive = true;
        this.localForwardDirection = this.config.LOCAL_FORWARD.clone();

        this.onAnimationFinishedCallback = null; // アニメーション終了時のコールバック
    }

    /**
     * 敵のモデルとアニメーションを初期化し、シーンに追加します。
     * @param {THREE.Group} modelInstance - 読み込まれた敵の3Dモデルインスタンス (通常はクローンされたもの)
     * @param {object} animations - 敵のアニメーションクリップのマップ
     */
    init(modelInstance, animations) {
        this.model = modelInstance;
        this.model.scale.setScalar(this.config.SCALE);
        this.scene.add(this.model);

        // メインメッシュを特定してプロパティに保持
        this.mainMesh = null;
        this.model.traverse(child => {
            if (child.isSkinnedMesh && !this.mainMesh) {
                this.mainMesh = child;
            } else if (child.isMesh && child.name.startsWith('Enemy_') && !this.mainMesh) {
                this.mainMesh = child;
            }
            if (child.isMesh) { // castShadow / receiveShadow を念のため再設定
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        if (!this.mainMesh) {
            console.warn(`Enemy (${this.config.MODEL_PATH}): Main mesh (SkinnedMesh or starting with 'Enemy_') not found in model. Fallback to using top-level model group for internal reference.`);
        }

        this.mixer = new THREE.AnimationMixer(this.model);
        this._setupAnimations(animations);

        // 物理ボディの作成 (引数を元の形に戻す)
        this._createPhysicsBody(
            this.model.position.clone(),
            this.config.HEIGHT, // ★ HEIGHT を直接渡す
            this.config.RADIUS, // ★ RADIUS を直接渡す
            this.config.MASS    // ★ MASS を直接渡す
        );

        if (this.mixer) {
            this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
        }
    }

    /**
     * アニメーションクリップを設定し、アクションを作成します。
     * @param {object} animationClips - アニメーションクリップのマップ
     */
    _setupAnimations(animationClips) {
        if (!this.mixer) return;

        for (const name in animationClips) {
            const clip = animationClips[name];
            if (clip instanceof THREE.AnimationClip) {
                this.actions[name] = this.mixer.clipAction(clip);
                if (name === 'idle' || name === 'run') {
                    this.actions[name].setLoop(THREE.LoopRepeat);
                } else {
                    this.actions[name].setLoop(THREE.LoopOnce);
                    this.actions[name].clampWhenFinished = true;
                }
            } else {
                console.warn(`Enemy (${this.config.MODEL_PATH}): Animation clip for "${name}" is not a valid THREE.AnimationClip or is missing.`);
            }
        }

        if (this.actions['idle']) {
            this.switchAnimation('idle');
        } else {
            console.warn(`Enemy (${this.config.MODEL_PATH}): 'idle' animation action not found.`);
        }
    }

    /**
     * 敵の物理ボディを作成し、PhysicsManagerに登録します。
     * @param {THREE.Vector3} initialPosition - 物理ボディの初期位置
     * @param {number} height - キャラクターの高さ
     * @param {number} radius - キャラクターの半径
     * @param {number} mass - キャラクターの質量
     */
    _createPhysicsBody(initialPosition, height, radius, mass) { // ★ 引数を元の形に戻す
        if (!this.physicsManager || !this.physicsManager.isInitialized()) {
            console.error("Enemy: PhysicsManager not ready. Cannot create physics body.");
            return;
        }

        // PhysicsManagerのcreateCharacterPhysicsBodyを、カプセル形状用の引数で呼び出す
        this.physicsBody = this.physicsManager.createCharacterPhysicsBody(
            initialPosition,
            height,
            radius,
            mass
        );

        if (this.physicsBody) {
            this.physicsBody.setAngularFactor(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0)); // Y軸回転のみ
            this.physicsBody.setFriction(this.config.FRICTION); // configから摩擦を設定
            this.physicsBody.setRestitution(this.config.RESTITUTION); // configから反発を設定
            this.syncPhysicsToModel(this.physicsManager.getTempTransform()); // 初期状態での物理ボディとモデルの同期
        } else {
            console.error(`Enemy (${this.config.MODEL_PATH}): Failed to create physics body.`);
        }
    }

    /**
     * アニメーション終了時に呼び出される内部ハンドラ。
     * @param {Event} event - アニメーション終了イベント
     */
    _onAnimationFinished(event) {
        const finishedAction = event.action;
        const finishedActionName = Object.keys(this.actions).find(name => this.actions[name] === finishedAction);

        if (this.onAnimationFinishedCallback) {
            this.onAnimationFinishedCallback(finishedActionName, this);
        }

        if (finishedActionName === 'attack') {
            this.switchAnimation('idle');
        }
    }

    /**
     * アニメーションを切り替えます。
     * @param {string} name - 切り替えるアニメーションの名前
     * @param {number} [crossFadeDuration=0.2] - クロスフェードの秒数
     */
    switchAnimation(name, crossFadeDuration = 0.2) {
        if (this.currentActionName === name && (name === 'idle' || name === 'run')) return;
        
        if (!this.mixer || !this.actions[name]) {
            console.warn(`Enemy (${this.config.MODEL_PATH}): Animation "${name}" not found.`);
            return;
        }

        const previousAction = this.actions[this.currentActionName];
        const nextAction = this.actions[name];

        if (previousAction && previousAction !== nextAction) {
            previousAction.fadeOut(crossFadeDuration);
        }

        nextAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(crossFadeDuration)
            .play();

        this.currentActionName = name;
    }

    /**
     * 敵のAIロジック、アニメーションの更新など、毎フレームの処理を行います。
     * @param {number} delta - 前フレームからの経過時間 (秒)
     */
    update(delta) {
        if (!this.isAlive || !this.model || !this.mixer) return;

        // AIロジックは今後ここに実装されます
        if (this.currentActionName !== 'idle' && this.currentActionName !== 'attack') {
             this.switchAnimation('idle');
        }

        this.mixer.update(delta);
    }

    /**
     * Ammo.jsの物理ボディの位置・回転をThree.jsのモデルに同期します。
     * @param {Ammo.btTransform} tempTransform - Ammo.jsの一時的な変換オブジェクト (メモリ割り当て削減のため)
     */
    syncPhysicsToModel(tempTransform) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                // 物理ボディの原点（カプセルの中心）から、Three.jsモデルの原点（足元）へのオフセットを適用
                // p.y() は物理ボディの重心のY座標
                // this.config.HEIGHT / 2 は、モデルの原点（足元）からその高さの中心までの距離
                this.model.position.set(p.x(), p.y() - this.config.HEIGHT / 2, p.z()); // ★ Yオフセット計算を元の形に戻す
            }
        }
    }

    /**
     * 敵にダメージを適用します。
     * @param {number} amount - 与えるダメージ量
     * @returns {boolean} 敵が死亡した場合はtrue、そうでなければfalse
     */
    applyDamage(amount) {
        if (!this.isAlive) return false;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            this.die();
            return true;
        }
        return false;
    }

    /**
     * 敵が死亡した際の処理を行います。
     */
    die() {
        console.log(`Enemy (${this.config.KEY}) died.`); 
        if (this.effectManager && this.model) {
            this.effectManager.createSparkExplosion(this.model.position.clone(), new THREE.Color(0xff8888));
            this.effectManager.createDebrisExplosion(this.model.position.clone(), new THREE.Color(0x555555));
        }
    }

    /**
     * この敵インスタンスに関連するリソースを解放します。
     * EnemyManagerが敵を削除する際に呼び出されます。
     */
    dispose() {
        if (this.mixer) {
            this.mixer.removeEventListener('finished', this._onAnimationFinished.bind(this));
            this.mixer.stopAllAction();
        }
        if (this.model && this.model.parent) {
            this.model.parent.remove(this.model);
        }
    }
}