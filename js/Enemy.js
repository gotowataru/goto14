// Enemy.js
import * as THREE from 'three';

export class Enemy {
    constructor(config, scene, physicsManager, effectManager, playerRefGetter) {
        this.config = config; // 敵の種類ごとの設定 (constants.js から)
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.effectManager = effectManager; // 将来的なエフェクト用
        this.getPlayerReference = playerRefGetter; // プレイヤーへの参照を取得する関数

        this.model = null; // AssetLoaderからロードされたモデルのクローン
        this.mixer = null;
        this.actions = {};
        this.currentActionName = null;
        this.physicsBody = null;

        this.hp = this.config.HP;
        this.isAlive = true;
        this.localForwardDirection = this.config.LOCAL_FORWARD.clone();

        // アニメーション終了時のコールバック (Character.jsと同様)
        this.onAnimationFinishedCallback = null;
    }

    // EnemyManagerからモデルとアニメーションを受け取って初期化
    init(modelInstance, animations) {
        this.model = modelInstance; // これはクローンされたインスタンス
        this.model.scale.setScalar(this.config.SCALE); // スケール適用
        this.scene.add(this.model);

        this.mixer = new THREE.AnimationMixer(this.model);
        this._setupAnimations(animations);

        // 物理ボディの作成 (位置はEnemyManagerが設定する)
        // 初期位置は、EnemyManagerがこのEnemyインスタンスを作成する際に、
        // modelInstance.position に設定してからこのinitを呼ぶ想定
        this._createPhysicsBody(
            this.model.position, // EnemyManagerが配置した位置
            this.config.HEIGHT,
            this.config.RADIUS,
            this.config.MASS
        );

        if (this.mixer) {
            this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
        }
    }

    _setupAnimations(animationClips) {
        if (!this.mixer) return;
        for (const name in animationClips) {
            const clip = animationClips[name];
            if (clip instanceof THREE.AnimationClip) {
                this.actions[name] = this.mixer.clipAction(clip);
                if (name === 'idle' || name === 'run') {
                    this.actions[name].setLoop(THREE.LoopRepeat);
                } else { // attack など
                    this.actions[name].setLoop(THREE.LoopOnce);
                    this.actions[name].clampWhenFinished = true;
                }
            } else {
                console.warn(`Enemy (${this.config.MODEL_PATH}): Animation clip for "${name}" is not valid. Clip:`, clip);
            }
        }
        if (this.actions['idle']) {
            this.switchAnimation('idle');
        } else {
            console.error(`Enemy (${this.config.MODEL_PATH}): 'idle' animation not found.`);
        }
    }

    _createPhysicsBody(initialPosition, height, radius, mass) {
        if (!this.physicsManager || !this.physicsManager.isInitialized()) {
            console.error("Enemy: PhysicsManager not ready. Cannot create physics body.");
            return;
        }
        // Characterと同様にカプセルを使うか、Boxを使うか選択
        // 今回は Character と同様のカプセル形状を想定
        // もしBoxなら physicsManager.createBoxPhysicsBody を使う
        const capsuleRadius = radius;
        const capsuleCylinderHeight = Math.max(0.01, height - (2 * capsuleRadius));

        this.physicsBody = this.physicsManager.createCharacterPhysicsBody( // または専用のcreateEnemyPhysicsBody
            initialPosition,
            height,
            radius,
            mass
        );

        if (this.physicsBody) {
            this.physicsBody.setAngularFactor(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0));
            this.physicsBody.setFriction(this.config.FRICTION);
            this.physicsBody.setRestitution(this.config.RESTITUTION);
            // 必要に応じて衝突グループやマスクを設定
            // this.physicsManager.physicsWorld.removeRigidBody(this.physicsBody); // 一旦削除して
            // this.physicsManager.addRigidBodyToWorld(this.physicsBody, ENEMY_COLLISION_GROUP, ENEMY_COLLISION_MASK); // 再追加

            this.syncPhysicsToModel(this.physicsManager.getTempTransform());
        } else {
            console.error(`Enemy (${this.config.MODEL_PATH}): Failed to create physics body.`);
        }
    }

    _onAnimationFinished(event) {
        const finishedAction = event.action;
        const finishedActionName = Object.keys(this.actions).find(name => this.actions[name] === finishedAction);

        if (this.onAnimationFinishedCallback) {
            this.onAnimationFinishedCallback(finishedActionName, this); // どの敵か分かるようにthisを渡す
        }
        // 例: 攻撃アニメーションが終わったらアイドルに戻るなど
        if (finishedActionName === 'attack') {
            this.switchAnimation('idle');
        }
    }

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

    update(delta) {
        if (!this.isAlive || !this.model || !this.mixer) return;

        // --- AIロジック (今回はプレースホルダー) ---
        // const player = this.getPlayerReference ? this.getPlayerReference() : null;
        // if (player) {
        //     const distanceToPlayer = this.model.position.distanceTo(player.model.position);
        //     // 索敵範囲、攻撃範囲などに基づいて行動を決定
        // }

        // --- アニメーションの更新 (AIの結果に応じて) ---
        // とりあえずアイドルを再生し続ける
        if (this.currentActionName !== 'idle' && this.currentActionName !== 'attack') { // 攻撃中は邪魔しない
             this.switchAnimation('idle');
        }


        this.mixer.update(delta);
    }

    syncPhysicsToModel(tempTransform) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                // Characterと同様のオフセット調整
                this.model.position.set(p.x(), p.y() - this.config.HEIGHT / 2, p.z());
                // 回転も同期する場合 (Characterは移動方向でモデル回転、物理は回転制限あり)
                // const q = tempTransform.getRotation();
                // this.model.quaternion.set(q.x(), q.y(), q.z(), q.w());
            }
        }
    }

    applyDamage(amount) {
        if (!this.isAlive) return false;
        this.hp -= amount;
        console.log(`Enemy (${this.config.MODEL_PATH}) took ${amount} damage, HP: ${this.hp}`);
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            this.die();
            return true; // 破壊された
        }
        return false; // まだ生きている
    }

    die() {
        console.log(`Enemy (${this.config.MODEL_PATH}) died.`);
        // 死亡アニメーション再生
        // if (this.actions['die']) this.switchAnimation('die');
        // else this.switchAnimation('idle'); // フォールバック

        // 死亡エフェクト (EffectManager を使用)
        if (this.effectManager) {
            this.effectManager.createSparkExplosion(this.model.position.clone(), new THREE.Color(0xff8888));
            this.effectManager.createDebrisExplosion(this.model.position.clone(), new THREE.Color(0x555555));
        }

        // 物理ボディの削除は EnemyManager に任せるか、ここでフラグを立てて Manager が処理
        // シーンからのモデル削除も同様
        // 今回は isAlive フラグで Manager 側で判断させる
    }

    // EnemyManagerがクリーンアップ時に呼ぶ
    dispose() {
        if (this.mixer) {
            this.mixer.removeEventListener('finished', this._onAnimationFinished.bind(this)); // リスナー削除
            this.mixer.stopAllAction();
        }
        if (this.model && this.model.parent) {
            this.model.parent.remove(this.model);
        }
        // ジオメトリやマテリアルはクローン元で管理されるので、ここでは破棄しない想定
        // (AssetLoaderでロードしたものをEnemyManagerがクローンして渡す場合)
        // もしEnemyごとにユニークなジオメトリ/マテリアルなら破棄が必要
        console.log(`Enemy (${this.config.MODEL_PATH}) disposed.`);
    }
}