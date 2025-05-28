// Enemy.js
import * as THREE from 'three';

import {
    ENEMY_001_MOVE_SPEED,
    // ENEMY_001_IDLE_DURATION, // 古い定数
    // ENEMY_001_RUN_DURATION,  // 古い定数
    ENEMY_001_IDLE_DURATION_MIN,
    ENEMY_001_IDLE_DURATION_MAX,
    ENEMY_001_RUN_DURATION_MIN,
    ENEMY_001_RUN_DURATION_MAX,
    ENEMY_001_TURN_CHANCE,
    ENEMY_001_TURN_SPEED,
    ENEMY_001_MAX_CONSECUTIVE_STRAIGHTS
} from './constants.js';


export class Enemy {
    constructor(config, scene, physicsManager, effectManager, playerRefGetter) {
        this.config = config; // config には HP や物理特性などが含まれる
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.effectManager = effectManager;
        this.getPlayerReference = playerRefGetter; // 将来のプレイヤー追跡用

        this.model = null;
        this.mainMesh = null; // 主要なメッシュ (SkinnedMeshなど)
        this.mixer = null;    // アニメーションミキサー
        this.actions = {};    // アニメーションアクションのマップ
        this.currentActionName = null;
        this.physicsBody = null; // Ammo.js の物理ボディ

        this.hp = this.config.HP;
        this.isAlive = true;

        this.scoreAwarded = false; // ★★★ スコア加算済みフラグを追加 ★★★

        this.localForwardDirection = this.config.LOCAL_FORWARD.clone(); // モデルのローカル前方ベクトル

        this.onAnimationFinishedCallback = null; // アニメーション終了時の外部コールバック




        // AI状態関連
        this.aiState = 'idle'; // 初期状態はアイドル
        this.stateTimer = 0;   // 現在の状態の経過時間
        this.currentIdleDuration = this._getRandomDuration(ENEMY_001_IDLE_DURATION_MIN, ENEMY_001_IDLE_DURATION_MAX);
        this.currentRunDuration = this._getRandomDuration(ENEMY_001_RUN_DURATION_MIN, ENEMY_001_RUN_DURATION_MAX);
        this.moveSpeed = ENEMY_001_MOVE_SPEED;

        // 移動方向と旋回に関する状態
        this.targetRotationY = 0; // 目標のY軸回転 (ラジアン)
        this.isTurning = false;   // 現在旋回中かどうかのフラグ
        this.consecutiveStraights = 0; // 同じ方向に直進した回数

        // 各インスタンスが少し異なるタイミングで行動開始するように初期タイマーにランダム性を加える
        this.stateTimer = Math.random() * this.currentIdleDuration;
    }

    // 範囲内のランダムな持続時間を取得するヘルパーメソッド
    _getRandomDuration(min, max) {
        return Math.random() * (max - min) + min;
    }

    init(modelInstance, animations) {
        this.model = modelInstance;
        // this.model.scale.setScalar(this.config.SCALE); // スケールはEnemyManagerまたはAssetLoaderで設定済み想定
        this.scene.add(this.model);

        // (mainMeshの取得ロジックは変更なし)
        this.mainMesh = null;
        this.model.traverse(child => {
            if (child.isSkinnedMesh && !this.mainMesh) {
                this.mainMesh = child;
            } else if (child.isMesh && child.name.startsWith('Enemy_') && !this.mainMesh) {
                // SkinnedMeshが見つからない場合のフォールバックとして、名前に基づくメッシュを探す
                this.mainMesh = child;
            }
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        if (!this.mainMesh && this.model.children.length > 0) {
            // それでも見つからなければ、最初の子メッシュを使う試み (最後の手段)
            const firstMesh = this.model.children.find(c => c.isMesh);
            if (firstMesh) this.mainMesh = firstMesh;
        }
        if (!this.mainMesh) {
            console.warn(`Enemy (${this.config.KEY || 'Unknown'}): Main mesh not reliably found. Effects or other logic might be impacted.`);
        }


        this.mixer = new THREE.AnimationMixer(this.model);
        this._setupAnimations(animations); // アニメーションの設定

        // 物理ボディの作成 (configから物理パラメータを取得)
        this._createPhysicsBody(
            this.model.position.clone(), // 初期位置
            this.config.HEIGHT,
            this.config.RADIUS,
            this.config.MASS
        );

        if (this.mixer) {
            this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
        }

        // 初期回転を設定 (スポーン時にランダムな方向を向かせるため)
        this.targetRotationY = Math.random() * Math.PI * 2;
        if (this.physicsBody) { // 物理ボディにも初期回転を適用
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.targetRotationY, 0));
            const ammoQuaternion = new this.physicsManager.AmmoAPI.btQuaternion(q.x, q.y, q.z, q.w);
            const transform = this.physicsBody.getWorldTransform();
            transform.setRotation(ammoQuaternion);
            this.physicsBody.setWorldTransform(transform);
        }
        this.model.rotation.y = this.targetRotationY; // モデルの回転も初期化
    }

    // (_setupAnimations, _createPhysicsBody, _onAnimationFinished, switchAnimation は変更なし)
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
                console.warn(`Enemy (${this.config.KEY || 'Unknown'}): Animation clip for "${name}" is not a valid THREE.AnimationClip or is missing.`);
            }
        }

        if (this.actions['idle']) {
            this.switchAnimation('idle');
        } else {
            console.warn(`Enemy (${this.config.KEY || 'Unknown'}): 'idle' animation action not found.`);
        }
    }

    _createPhysicsBody(initialPosition, height, radius, mass) {
        if (!this.physicsManager || !this.physicsManager.isInitialized()) {
            console.error("Enemy: PhysicsManager not ready. Cannot create physics body.");
            return;
        }
        const physicsProperties = {
            friction: this.config.FRICTION,
            restitution: this.config.RESTITUTION
        };
        this.physicsBody = this.physicsManager.createCharacterPhysicsBody(
            initialPosition, height, radius, mass, physicsProperties
        );
        if (this.physicsBody) {
            // 物理ボディが回転しないように角速度を固定 (上下運動は許可)
            this.physicsBody.setAngularFactor(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0));
            this.syncPhysicsToModel(this.physicsManager.getTempTransform());
        } else {
            console.error(`Enemy (${this.config.KEY || 'Unknown'}): Failed to create physics body.`);
        }
    }

    _onAnimationFinished(event) {
        const finishedAction = event.action;
        // アクション名を取得
        const finishedActionName = Object.keys(this.actions).find(name => this.actions[name] === finishedAction);

        if (this.onAnimationFinishedCallback) {
            this.onAnimationFinishedCallback(finishedActionName, this); // EnemyManager へ通知
        }

        // 例: 攻撃アニメーションが終わったらアイドルに戻る (現在は攻撃未実装)
        if (finishedActionName === 'attack') {
            this.switchAnimation('idle');
        }
        // 他の単発アニメーションの終了処理が必要ならここに追加
    }

    switchAnimation(name, crossFadeDuration = 0.2) {
        // 同じアニメーションへの切り替え（ループアニメーションの場合）は無視
        if (this.currentActionName === name && (name === 'idle' || name === 'run')) return;

        if (!this.mixer || !this.actions[name]) {
            console.warn(`Enemy (${this.config.KEY || 'Unknown'}): Animation "${name}" not found or mixer not ready.`);
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
        if (!this.isAlive || !this.model || !this.mixer || !this.physicsBody) return;

        this.stateTimer += delta;
        const player = this.getPlayerReference(); // 将来の追跡AI用

        // --- 旋回処理 ---
        if (this.isTurning) {
            const currentRotationY = this.model.rotation.y;
            const diff = THREE.MathUtils.radToDeg(this.targetRotationY - currentRotationY); // 角度差

            // 最短距離で旋回するための調整
            let angleToTurn = this.targetRotationY - currentRotationY;
            while (angleToTurn > Math.PI) angleToTurn -= Math.PI * 2;
            while (angleToTurn < -Math.PI) angleToTurn += Math.PI * 2;

            const turnAmount = ENEMY_001_TURN_SPEED * delta * Math.sign(angleToTurn);

            if (Math.abs(angleToTurn) > Math.abs(turnAmount)) {
                this.model.rotation.y += turnAmount;
            } else {
                this.model.rotation.y = this.targetRotationY;
                this.isTurning = false; // 旋回完了
                // console.log(`Enemy ${this.config.KEY}: Turn complete. Target Y: ${this.targetRotationY.toFixed(2)}`);
            }
            // 旋回中は移動しない or ゆっくり移動する (現在は停止)
            this.physicsBody.setLinearVelocity(new this.physicsManager.AmmoAPI.btVector3(0, this.physicsBody.getLinearVelocity().y(), 0));
            this.physicsBody.activate();
            this.mixer.update(delta);
            this.syncPhysicsToModel(this.physicsManager.getTempTransform()); // 旋回中も物理同期は行う
            return; // 旋回中は他のAIロジックをスキップ
        }

        // --- AI状態遷移と行動 ---
        let targetVelocityX = 0;
        let targetVelocityZ = 0;
        const currentYVelocity = this.physicsBody.getLinearVelocity().y(); // 現在のY軸速度を保持 (ジャンプや落下のため)

        switch (this.aiState) {
            case 'idle':
                if (this.currentActionName !== 'idle') {
                    this.switchAnimation('idle');
                }
                // targetVelocityX, targetVelocityZ は 0 のまま

                if (this.stateTimer >= this.currentIdleDuration) {
                    // アイドル終了、次の行動へ
                    this.aiState = 'decide_next_action'; // 新しい中間状態
                    this.stateTimer = 0;
                }
                break;

            case 'decide_next_action':
                // プレイヤーが近くにいるか、などの条件で行動分岐 (将来用)
                // if (player && this.model.position.distanceTo(player.model.position) < 10) {
                // this.aiState = 'chasing';
                // } else { ... }

                // 現在はランダムに旋回するか直進するかを決める
                if (this.consecutiveStraights >= ENEMY_001_MAX_CONSECUTIVE_STRAIGHTS || Math.random() < ENEMY_001_TURN_CHANCE) {
                    // 新しいランダムな目標回転を設定 (現在の向き以外)
                    let newTargetY;
                    do {
                        newTargetY = Math.random() * Math.PI * 2;
                    } while (Math.abs(newTargetY - this.targetRotationY) < Math.PI / 4); // あまりに近い方向は避ける
                    this.targetRotationY = newTargetY;
                    this.isTurning = true;
                    // console.log(`Enemy ${this.config.KEY}: Decided to turn. New target Y: ${this.targetRotationY.toFixed(2)}`);
                    this.consecutiveStraights = 0; // 旋回したら連続直進カウントリセット
                } else {
                    // console.log(`Enemy ${this.config.KEY}: Decided to run straight.`);
                    this.consecutiveStraights++;
                }
                this.aiState = 'running'; // 旋回するか直進するかの準備完了、次はrunning状態へ
                this.currentRunDuration = this._getRandomDuration(ENEMY_001_RUN_DURATION_MIN, ENEMY_001_RUN_DURATION_MAX);
                this.stateTimer = 0; // running状態のタイマーリセット
                if (this.currentActionName !== 'run') { // 旋回しない場合でもrunアニメーションに
                    this.switchAnimation('run');
                }
                break;

            case 'running':
                if (this.isTurning) break; // 旋回中ならrunningの移動ロジックはスキップ

                if (this.currentActionName !== 'run') {
                    this.switchAnimation('run');
                }

                // モデルの現在の向き（model.quaternionから計算）に前進
                const worldForward = new THREE.Vector3();
                this.model.getWorldDirection(worldForward); // モデルのワールド空間での前方ベクトル
                worldForward.y = 0; // Y軸方向の移動は物理エンジンに任せるので0にする
                worldForward.normalize();

                const desiredHorizontalVelocity = worldForward.multiplyScalar(this.moveSpeed);
                targetVelocityX = desiredHorizontalVelocity.x;
                targetVelocityZ = desiredHorizontalVelocity.z;

                if (this.stateTimer >= this.currentRunDuration) {
                    this.aiState = 'idle'; // アイドルに戻る
                    this.currentIdleDuration = this._getRandomDuration(ENEMY_001_IDLE_DURATION_MIN, ENEMY_001_IDLE_DURATION_MAX);
                    this.stateTimer = 0;
                }
                break;

            // (将来用) case 'chasing':
            // (将来用) case 'attacking':
        }

        // 物理ボディに速度を設定
        this.physicsBody.setLinearVelocity(
            new this.physicsManager.AmmoAPI.btVector3(targetVelocityX, currentYVelocity, targetVelocityZ)
        );
        this.physicsBody.activate(); // ボディがスリープ状態になるのを防ぐ

        this.mixer.update(delta); // アニメーションミキサーの更新
    }

    // (syncPhysicsToModel, applyDamage, die, dispose は変更なし)
    syncPhysicsToModel(tempTransform) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                // 物理ボディはカプセルの中心を示すので、モデルの足元に合わせるために高さを調整
                this.model.position.set(p.x(), p.y() - this.config.HEIGHT / 2, p.z());

                // 物理エンジンによる回転はモデルに適用しない (Y軸回転はAIで制御するため)
                // もし物理エンジンに回転も任せる場合は以下のコメントを解除
                // const q = tempTransform.getRotation();
                // this.model.quaternion.set(q.x(), q.y(), q.z(), q.w());

                // 代わりに、AIで制御している model.rotation.y を物理ボディにも反映させる（必要なら）
                // ただし、CharacterController的な物理ボディは通常、回転は外部から設定し、
                // 物理エンジン自体は回転させないことが多い。
                // ここでは、物理ボディの回転は setAngularFactor で制限しているため、
                // モデルのY軸回転のみを直接更新する。
            }
        }
    }

    applyDamage(amount) {
        if (!this.isAlive) {
            // console.log(`Enemy (${this.config.KEY || 'Unknown'}) is already dead, cannot apply damage.`);
            return false; // ダメージは適用されなかった
        }
        this.hp -= amount;
        // console.log(`Enemy (${this.config.KEY || 'Unknown'}) took ${amount} damage. Current HP: ${this.hp}`);
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            this.die();
        }
        return true; // ダメージが適用された
    }

    die() {
        // console.log(`Enemy (${this.config.KEY || 'Unknown'}) died.`);
        if (this.effectManager && this.model) {
            // 簡単な死亡エフェクト
            this.effectManager.createSparkExplosion(this.model.position.clone().add(new THREE.Vector3(0, this.config.HEIGHT / 2, 0)), new THREE.Color(0xff8888));
            this.effectManager.createDebrisExplosion(this.model.position.clone().add(new THREE.Vector3(0, this.config.HEIGHT / 2, 0)), new THREE.Color(0x555555));
        }
        // 死亡アニメーションがあるならここで再生を指示
        // if (this.actions['death']) {
        //     this.switchAnimation('death');
        //     this.physicsBody.setActivationState(0); // Deactivate physics body
        // } else {
        //     // 死亡アニメーションがない場合は即座に消すか、フェードアウトなど
        // }

        // 物理ボディを無効化または削除する処理は EnemyManager の removeEnemy で行われるので、
        // ここでは isAlive フラグの変更とエフェクト程度に留める。
    }

    dispose() {
        if (this.mixer) {
            this.mixer.removeEventListener('finished', this._onAnimationFinished.bind(this)); // bind(this)しないと解除できない
            this.mixer.stopAllAction();
            // this.mixer = null; // 明示的にnull化
        }
        // モデルの削除は EnemyManager の removeEnemy -> enemy.dispose() -> model.parent.remove(model) の流れ
        if (this.model && this.model.parent) {
            this.model.parent.remove(this.model);
        }
        // this.model = null;

        // 物理ボディの削除は EnemyManager の removeEnemy で行われる
        // if (this.physicsBody && this.physicsManager) {
        // this.physicsManager.removeRigidBody(this.physicsBody);
        // this.physicsBody = null;
        // }
    }
}