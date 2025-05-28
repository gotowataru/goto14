// Character.js
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // 分身用にインポート
import {
    CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS,
    CHARACTER_FRICTION, CHARACTER_RESTITUTION, CHARACTER_SPEED,
    // ★★★ ↓このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★
    //     // ジャンプ関連の定数をインポート 残す。
    //     CHARACTER_JUMP_FORCE, // または CHARACTER_JUMP_INITIAL_VELOCITY
    //     CHARACTER_MAX_JUMPS,
    // 分身関連の定数をインポート
    // CHARACTER_CLONE_OFFSET_DISTANCE_FACTOR, // 固定位置用だったので、新しい定数で置き換え or 調整
    CHARACTER_CLONE_OPACITY,
    // CHARACTER_CLONE_COLOR, // オプション
    // ★★★ オプション追従関連の定数をインポート ★★★
    OPTION_HISTORY_LENGTH,
    OPTION_DELAY_PER_CLONE,
    OPTION_FOLLOW_SPEED,
    OPTION_MIN_DISTANCE_TO_PREVIOUS,
    OPTION_SIDE_OFFSET_BASE,
    OPTION_SIDE_OFFSET_INCREMENT,
    KICK_BEAM_DELAY,
    BEAM_SPAWN_OFFSET_FORWARD,
    MAKANKO_BEAM_TYPE_ENABLED,
} from './constants.js';

export class Character {
    constructor(model, animations, scene, physicsManager, initialPosition, initialScale, localForwardVec, projectileManager) {

        this.originalModelSource = model;
        this.model = SkeletonUtils.clone(this.originalModelSource);

        this.scene = scene;
        this.physicsManager = physicsManager; // PhysicsManagerのインスタンスを保持
        this.projectileManager = projectileManager;
        this.localForwardDirection = localForwardVec.clone();
        this.initialScale = initialScale;

        this.model.scale.setScalar(initialScale); // クローンした本体モデルにスケール適用
        this.scene.add(this.model);

        this.mixer = new THREE.AnimationMixer(this.model); // 本体モデル用のミキサー
        this.animations = {}; // 本体のアニメーションクリップ（複製したもの）を格納
        this.actions = {};
        this.currentActionName = null;
        this.onAnimationFinishedCallback = null;

        this.canPlayAction = true;
        this.moveDirection = new THREE.Vector3();
        this.cameraDirection = new THREE.Vector3();
        this.physicsBody = null;
        this.isMoving = false;
        this.kickActionStartTime = null;
        this.beamGeneratedDuringKick = false;
        this.isGrounded = true; // (ジャンプ機能用)
        this.isAlive = true;    // キャラクターの生存フラグ

        // パワーアップと分身関連のプロパティ
        this.currentPowerLevel = 0;
        this.baseSpeed = CHARACTER_SPEED; // 元の速度
        this.speed = this.baseSpeed;      // 現在の速度 (パワーアップで変化)

        this.clones = []; // 分身の THREE.Object3D を保持する配列
        this.cloneMaterialProperties = null; // 分身用の半透明マテリアルのプロパティ
        this.maxClones = 0; // 現在のパワーアップレベルで許可される分身の最大数

        // オプション追従用の履歴
        this.positionHistory = []; // { position: Vector3, quaternion: Quaternion, timestamp: number } の配列
        this.historyCounter = 0;   // リングバッファのように履歴を管理するためのカウンター

        // アニメーションクリップを複製して本体用にセットアップ
        const originalAnimationClips = animations; // AssetLoaderから渡されたアニメーションクリップ集
        for (const name in originalAnimationClips) {
            if (originalAnimationClips[name] instanceof THREE.AnimationClip) {
                this.animations[name] = originalAnimationClips[name].clone(); // クリップを複製
            }
        }
        this._setupAnimations(this.animations); // 複製したクリップで本体のアニメーション設定

        this._createPhysicsBody(initialPosition, CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS);

        if (this.mixer) {
            this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
        }
    }

    _setupAnimations(animationClips) { // このメソッドは主に本体用
        if (!this.mixer) {
            console.error("Character._setupAnimations (Main): Mixer not initialized.");
            return;
        }
        for (const name in animationClips) { // animationClips は複製済みのものを期待
            const clip = animationClips[name];
            if (clip instanceof THREE.AnimationClip) {
                this.actions[name] = this.mixer.clipAction(clip);
                if (name === 'idle' || name === 'run') {
                    this.actions[name].setLoop(THREE.LoopRepeat);
                // --- JUMP: ジャンプアニメーションの設定をコメントアウト ---
                // } else if (name === 'jump') {
                //     this.actions[name].setLoop(THREE.LoopOnce);
                //     this.actions[name].clampWhenFinished = true;
                // --- JUMP: ここまで ---
                } else { // kick など
                    this.actions[name].setLoop(THREE.LoopOnce);
                    this.actions[name].clampWhenFinished = true;
                }
            } else {
                console.warn(`Character._setupAnimations (Main): Animation clip for "${name}" is not a valid THREE.AnimationClip or is missing. Received:`, clip);
            }
        }
        if (this.actions['idle']) {
            this.switchAnimation('idle'); // 初期アニメーションを再生
        } else {
            console.error("Character._setupAnimations (Main): 'idle' animation action not found. Cannot set initial animation.");
        }
    }

    _createPhysicsBody(initialPosition, height, radius, mass) {
        if (!this.physicsManager || !this.physicsManager.isInitialized()) {
            console.error("Character: PhysicsManager not ready. Cannot create physics body.");
            return;
        }
        const playerPhysicsProperties = {
            friction: CHARACTER_FRICTION,
            restitution: CHARACTER_RESTITUTION
        };
        this.physicsBody = this.physicsManager.createCharacterPhysicsBody(
            initialPosition, height, radius, mass, playerPhysicsProperties
        );
        if (this.physicsBody) {
            this.physicsBody.setAngularFactor(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0));
            this.syncPhysicsToModel(this.physicsManager.getTempTransform(), height);
        } else {
            console.error("Character._createPhysicsBody: Failed to create physics body.");
        }
    }

    _onAnimationFinished(event) {
        const finishedAction = event.action;
        const finishedActionName = Object.keys(this.actions).find(name => this.actions[name] === finishedAction);
        if (this.onAnimationFinishedCallback) {
            this.onAnimationFinishedCallback(finishedActionName); // Game.js へ通知
        }
    }

    switchAnimation(name, crossFadeDuration = 0.2) {
        // 本体のアニメーション切り替え
        if (!this.mixer || !this.actions[name]) {
            // console.warn(`Character.switchAnimation (Main): Animation "${name}" not found or mixer not ready.`);
            return;
        }
        // 同じループアニメーションへの不要な切り替えを防ぐ
        if(this.currentActionName === name && (name === 'idle' || name === 'run')) {
            return;
        }

        const previousAction = this.actions[this.currentActionName];
        const nextAction = this.actions[name];

        if (previousAction && previousAction !== nextAction) {
            previousAction.fadeOut(crossFadeDuration);
        }
        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(crossFadeDuration).play();
        this.currentActionName = name;

        // 特定のアクション開始時の処理
        if (name === 'kick') {
            this.canPlayAction = false;
            this.kickActionStartTime = performance.now();
            this.beamGeneratedDuringKick = false;

            // 分身にもキック開始情報を伝播 (userData を使用)
            this.clones.forEach(clone => {
                if (!clone.userData) clone.userData = {}; // userDataがなければ初期化
                clone.userData.kickActionStartTime = this.kickActionStartTime;
                clone.userData.beamGeneratedDuringKick = false;
            });
        } else {
            this.kickActionStartTime = null;
            // 分身のキック関連情報もリセット (必要に応じて)
            this.clones.forEach(clone => {
                if (clone.userData) {
                    clone.userData.kickActionStartTime = null;
                }
            });
        }

        // 分身のアニメーションも同期
        this.clones.forEach(clone => {
            if (clone.userData.mixer && clone.userData.actions) {
                const clonePrevAction = clone.userData.actions[clone.userData.currentActionName]; // 分身の「前の」アクション名
                const cloneNextAction = clone.userData.actions[name]; // これから再生するアクション名

                if (cloneNextAction) {
                    if (clonePrevAction && clonePrevAction !== cloneNextAction) {
                        clonePrevAction.fadeOut(crossFadeDuration);
                    }
                    cloneNextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(crossFadeDuration).play();
                    clone.userData.currentActionName = name; // 分身の現在のアクション名を更新
                } else {
                    // console.warn(`Character.switchAnimation (Clone): Animation "${name}" not found for clone.`);
                }
            }
        });
    }

    update(delta, inputManager, camera, speed, rotationSpeed) {
        if (!this.model || !this.mixer || !this.physicsBody || !this.isAlive) return;

        let disableMovementInput = false;
        if (this.currentActionName === 'kick' && this.actions['kick'] && this.actions['kick'].isRunning()) {
            disableMovementInput = true;
　　　　}

        // 移動履歴を記録
        this.recordHistory();

        const moveF = inputManager.isPhysicalKeyPressed('KeyW') || inputManager.isPhysicalKeyPressed('ArrowUp');
        const moveB = inputManager.isPhysicalKeyPressed('KeyS') || inputManager.isPhysicalKeyPressed('ArrowDown');
        const moveL = inputManager.isPhysicalKeyPressed('KeyA') || inputManager.isPhysicalKeyPressed('ArrowLeft');
        const moveR = inputManager.isPhysicalKeyPressed('KeyD') || inputManager.isPhysicalKeyPressed('ArrowRight');

        this.isMoving = false;
        this.moveDirection.set(0, 0, 0);
        let targetSpeed = 0;
        const effectiveSpeed = this.speed; // パワーアップ適用後の速度を使用

        // ★★★ ↓このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★
        // Geminiが勝手に変更して左右移動が逆になるので注意！ Fixed, DO NOT CHANGE - Gemini
        if (!disableMovementInput) { // このブロックは変更しない
            const isTryingToMove = moveF || moveB || moveL || moveR;
            if (isTryingToMove) {
                this.isMoving = true;
                camera.getWorldDirection(this.cameraDirection);
                this.cameraDirection.y = 0;
                this.cameraDirection.normalize();
                const rightDirection = new THREE.Vector3().crossVectors(this.cameraDirection, camera.up).normalize();

                if (moveF) this.moveDirection.add(this.cameraDirection);
                if (moveB) this.moveDirection.sub(this.cameraDirection);
                if (moveL) this.moveDirection.sub(rightDirection); // 左移動
                if (moveR) this.moveDirection.add(rightDirection); // 右移動

                if (this.moveDirection.lengthSq() > 0) {
                    this.moveDirection.normalize();
                    targetSpeed = effectiveSpeed;
                    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(this.localForwardDirection, this.moveDirection);
                    this.model.quaternion.slerp(targetQuaternion, rotationSpeed * delta * 5.0);
                }
            }
        }
        // ★★★ ↑このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★

        const currentVelocity = this.physicsBody.getLinearVelocity();
        const desiredVelocity = new this.physicsManager.AmmoAPI.btVector3(
            this.moveDirection.x * targetSpeed,
            currentVelocity.y(),
            this.moveDirection.z * targetSpeed
        );
        this.physicsBody.setLinearVelocity(desiredVelocity);

        if (targetSpeed > 0) {
            this.physicsBody.activate();
        }

        const actualHorizontalSpeed = Math.sqrt(desiredVelocity.x() * desiredVelocity.x() + desiredVelocity.z() * desiredVelocity.z());
        let targetAnimation;
         if (this.currentActionName === 'kick' && this.actions['kick'] && this.actions['kick'].isRunning()) {
             targetAnimation = 'kick';
         } else if (actualHorizontalSpeed > effectiveSpeed * 0.01) { // effectiveSpeed を基準に
             targetAnimation = 'run';
         } else {
             targetAnimation = 'idle';
         }
         if (this.currentActionName !== targetAnimation && this.actions[targetAnimation]) {
             this.switchAnimation(targetAnimation);
         } else if (!this.actions[targetAnimation] && targetAnimation !== 'kick') {
              // console.warn(`Character.update: Target animation "${targetAnimation}" does not exist.`);
         }

         this.mixer.update(delta); // 本体ミキサーの更新

         // 分身のアニメーションミキサーを更新
         this.clones.forEach(clone => {
             if (clone.userData.mixer) {
                 clone.userData.mixer.update(delta);
             }
         });

         // 分身の位置を更新 (オプション風追従)
         this.updateClonePositionsOptionStyle(delta);
     }

    syncPhysicsToModel(tempTransform, characterHeight) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                this.model.position.set(p.x(), p.y() - characterHeight / 2, p.z());
                // キャラクターの回転はupdateメソッド内でSlerpで制御
            }
        }
    }

    startKickAction() {
        if (this.canPlayAction) {
            this.switchAnimation('kick'); // これにより分身の kickActionStartTime などもセットされる
            return true;
        }
        return false;
    }

    // 本体キャラクターがビームを発射する処理
    fireMainBeam() {
        if (this.beamGeneratedDuringKick) return; // 既にこのキックで発射済みなら何もしない

        // console.log("Character.fireMainBeam: Firing main beam.");
        const worldForward = this.localForwardDirection.clone().applyQuaternion(this.model.quaternion);
        this.projectileManager.createRings(this.model, worldForward);
        this.projectileManager.createBeam(
            this.model, worldForward, CHARACTER_HEIGHT,
            BEAM_SPAWN_OFFSET_FORWARD, MAKANKO_BEAM_TYPE_ENABLED,
        );
        this.beamGeneratedDuringKick = true;
    }

    // 分身がビームを発射する処理
    fireCloneBeams() {
        this.clones.forEach(clone => {
            if (!clone.userData) return; // userData がなければ何もしない
            // 分身がキックアクション中で、まだこのキックでビームを発射していない場合
            if (clone.userData.kickActionStartTime && !clone.userData.beamGeneratedDuringKick) {
                // console.log(`Character.fireCloneBeams: Firing beam for clone:`, clone.uuid);
                // 分身の位置と向きを取得
                const cloneWorldForward = this.localForwardDirection.clone().applyQuaternion(clone.quaternion); // 分身の向き

                // リングは分身からは出さない（オプション）か、出すなら別途調整
                // this.projectileManager.createRings(clone, cloneWorldForward);

                // ビームを発射 (本体と同じ設定を使用)
                this.projectileManager.createBeam(
                    clone, cloneWorldForward, CHARACTER_HEIGHT, // 分身のモデルと向き、高さを使用
                    BEAM_SPAWN_OFFSET_FORWARD, MAKANKO_BEAM_TYPE_ENABLED,
                );
                clone.userData.beamGeneratedDuringKick = true;
            }
        });
    }


    applyPowerUp(level) {
        this.currentPowerLevel = level;
        console.log(`Character.applyPowerUp: Applying power up to Level ${level}`); // ログを少し変更

        if (level === 1) {
            this.maxClones = 1;
            // this.speed = this.baseSpeed * 1.05; // 速度変更は今回は保留
            console.log("Character PowerUp Level 1: Max clones set to 1.");
        } else if (level === 2) {
            this.maxClones = 2;
            // this.speed = this.baseSpeed * 1.1; // 速度変更は今回は保留
            console.log("Character PowerUp Level 2: Max clones set to 2.");
        } else if (level === 3) { // 追加: レベル3の処理
            this.maxClones = 3;
            // this.speed = this.baseSpeed * 1.15; // (将来用) 速度変更は今回は保留
            console.log("Character PowerUp Level 3: Max clones set to 3.");
        } else if (level === 4) { // 追加: レベル4の処理
            this.maxClones = 4;
            // this.speed = this.baseSpeed * 1.2; // (将来用) 速度変更は今回は保留
            console.log("Character PowerUp Level 4: Max clones set to 4.");
        }
        // 他のレベルのパワーアップが必要な場合は、ここに追加
        
        this.updateClones(); // 分身の数と表示を更新
    }

    updateClones() { // このメソッドは分身の数を調整する役割
        if (!this.model) return;
        // console.log(`Character.updateClones: Before - Clones: ${this.clones.length}, Max: ${this.maxClones}`);
        while (this.clones.length > this.maxClones) {
            const cloneToRemove = this.clones.pop();
            if (cloneToRemove) {
                // if (this.model.children.includes(cloneToRemove)) this.model.remove(cloneToRemove); // 本体の子ではなくなった
                if (this.scene.children.includes(cloneToRemove)) this.scene.remove(cloneToRemove); // シーンから直接削除
                this.disposeClone(cloneToRemove);
                // console.log("Character.updateClones: Removed a clone.");
            }
        }
        while (this.clones.length < this.maxClones) {
            // console.log("Character.updateClones: Need to add a clone.");
            this.addClone();
        }
        // console.log(`Character.updateClones: After - Clones: ${this.clones.length}`);
        // positionClonesFixed() は呼ばない。新しい追従ロジックで毎フレーム位置が決まる。
    }

    addClone() {
        if (!this.originalModelSource) {
            console.warn("Character.addClone: Original model source is null. Cannot add clone.");
            return;
        }
        if (!this.model || !this.model.parent) { // 本体モデルがシーンに追加されているか確認
            console.warn("Character.addClone: Character model (this.model) not ready or not in scene. Cannot add clone.");
            return;
        }
        if (this.clones.length >= this.maxClones) {
            return;
        }

        // console.log("%cCharacter.addClone: Attempting to clone from originalModelSource...", "color: blue; font-weight: bold;");
        let cloneModel = null;
        try {
            cloneModel = SkeletonUtils.clone(this.originalModelSource); // 常に元の綺麗なモデルからクローン
            // console.log("Character.addClone: SkeletonUtils.clone call finished using originalModelSource.");
        } catch (e_clone) {
            console.error("%cCharacter.addClone: CRITICAL ERROR during SkeletonUtils.clone from originalModelSource:", "color: red; font-weight: bold;", e_clone);
            return;
        }

        if (!cloneModel) {
            console.error("Character.addClone: SkeletonUtils.clone (from originalModelSource) returned null or undefined. Cloning failed.");
            return;
        }
        // console.log("Character.addClone: Model cloned successfully from originalModelSource. Proceeding with clone setup.");

        cloneModel.scale.setScalar(this.initialScale); // クローンしたモデルにスケールを適用

        if (!this.cloneMaterialProperties) {
            this.cloneMaterialProperties = {
                transparent: true,
                opacity: CHARACTER_CLONE_OPACITY,
                depthWrite: false,
                // color: CHARACTER_CLONE_COLOR !== undefined ? CHARACTER_CLONE_COLOR : null,
            };
        }
        cloneModel.traverse(child => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        const newMat = mat.clone();
                        Object.assign(newMat, this.cloneMaterialProperties);
                        if (this.cloneMaterialProperties.color && typeof this.cloneMaterialProperties.color !== 'undefined') newMat.color.set(this.cloneMaterialProperties.color);
                        return newMat;
                    });
                } else if (child.material) {
                    const newMat = child.material.clone();
                    Object.assign(newMat, this.cloneMaterialProperties);
                    if (this.cloneMaterialProperties.color && typeof this.cloneMaterialProperties.color !== 'undefined') newMat.color.set(this.cloneMaterialProperties.color);
                    child.material = newMat;
                }
                child.castShadow = false;
            }
        });

        cloneModel.userData.mixer = new THREE.AnimationMixer(cloneModel);
        cloneModel.userData.actions = {};
        if (!cloneModel.userData) cloneModel.userData = {}; // userData がなければ初期化 (念のため)
        cloneModel.userData.kickActionStartTime = null; // 分身用のビーム発射関連プロパティを初期化
        cloneModel.userData.beamGeneratedDuringKick = false;
        const sourceAnimations = this.animations; // 本体用に複製されたアニメーションクリップを使用

        for (const animName in sourceAnimations) {
            const clip = sourceAnimations[animName];
            if (clip instanceof THREE.AnimationClip) {
                const clonedClip = clip.clone(); // 各分身用にアニメーションクリップも複製する
                cloneModel.userData.actions[animName] = cloneModel.userData.mixer.clipAction(clonedClip);
                if (animName === 'idle' || animName === 'run') {
                    cloneModel.userData.actions[animName].setLoop(THREE.LoopRepeat);
                } else {
                    cloneModel.userData.actions[animName].setLoop(THREE.LoopOnce);
                    cloneModel.userData.actions[animName].clampWhenFinished = true;
                }
            }
        }
        if (this.currentActionName && cloneModel.userData.actions[this.currentActionName]) {
            cloneModel.userData.actions[this.currentActionName].play();
            cloneModel.userData.currentActionName = this.currentActionName;
        } else if (cloneModel.userData.actions['idle']) {
             cloneModel.userData.actions['idle'].play();
             cloneModel.userData.currentActionName = 'idle';
        }

        this.scene.add(cloneModel); // 分身はシーンに直接追加
        cloneModel.position.copy(this.model.position); // 初期位置を本体に合わせる
        cloneModel.quaternion.copy(this.model.quaternion);

        this.clones.push(cloneModel);
        // console.log(`%cCharacter.addClone: Clone successfully added to scene. Total clones: ${this.clones.length}`, "color: green; font-weight: bold;");
    }

    // positionClonesFixed() は不要になったので削除またはコメントアウト
    /*
    positionClonesFixed() {
        // このメソッドは固定位置用だったので、オプション追従では使用しません。
        // もし残す場合は、デバッグ用や別のパワーアップ形態用として明確に区別してください。
        if (this.clones.length === 0) return;
        const cloneOffsetDistance = CHARACTER_RADIUS * this.initialScale * CHARACTER_CLONE_OFFSET_DISTANCE_FACTOR;
        if (this.clones.length > 0 && this.clones[0]) {
            this.clones[0].position.set(cloneOffsetDistance, 0, 0);
            this.clones[0].rotation.set(0,0,0);
        }
        if (this.clones.length > 1 && this.clones[1]) {
            this.clones[1].position.set(-cloneOffsetDistance, 0, 0);
            this.clones[1].rotation.set(0,0,0);
        }
    }
    */

    // 移動履歴を記録するメソッド
    recordHistory() {
        if (!this.model) return;

        let timestamp;
        // PhysicsManager とそのメソッドの存在を安全にチェック
        if (this.physicsManager &&
            typeof this.physicsManager.isInitialized === 'function' && this.physicsManager.isInitialized() &&
            typeof this.physicsManager.getWorld === 'function') {
            const world = this.physicsManager.getWorld();
            if (world && typeof world.getWorldInfo === 'function') {
                const worldInfo = world.getWorldInfo();
                if (worldInfo && typeof worldInfo.getTime === 'function') {
                    timestamp = worldInfo.getTime();
                } else {
                    // console.warn("Character.recordHistory: worldInfo.getTime() is not available.");
                    timestamp = performance.now(); // フォールバック
                }
            } else {
                // console.warn("Character.recordHistory: physicsManager.getWorld() did not return a valid world or worldInfo is not available.");
                timestamp = performance.now(); // フォールバック
            }
        } else {
            // console.warn("Character.recordHistory: physicsManager or its required methods are not available for timestamping.");
            timestamp = performance.now(); // フォールバック
        }

        const newHistoryEntry = {
            position: this.model.position.clone(),
            quaternion: this.model.quaternion.clone(),
            timestamp: timestamp
        };

        // リングバッファとして履歴を管理
        if (this.positionHistory.length < OPTION_HISTORY_LENGTH) {
            this.positionHistory.push(newHistoryEntry);
        } else {
            this.positionHistory[this.historyCounter] = newHistoryEntry;
            this.historyCounter = (this.historyCounter + 1) % OPTION_HISTORY_LENGTH;
        }
    }

    // グラディウスオプション風に分身の位置を更新するメソッド
    updateClonePositionsOptionStyle(delta) {
        if (this.clones.length === 0 || this.positionHistory.length === 0) {
            return;
        }

        let previousTargetObject3D = this.model; // 最初のオプションは本体を基準にする

        for (let i = 0; i < this.clones.length; i++) {
            const clone = this.clones[i];
            if (!clone) continue;

            // 1. 履歴からターゲットとなる位置と回転を取得
            let targetEntry = null;
            // (i+1) 番目のオプション。i=0 が1体目、i=1 が2体目。
            // 後ろのオプションほど、より過去の履歴を参照するようにオフセットを大きくする
            const desiredHistoryOffset = (i + 1) * OPTION_DELAY_PER_CLONE;

            if (this.positionHistory.length > desiredHistoryOffset) {
                // 最新の履歴が格納されているインデックス (historyCounterは次に書き込む場所なので-1)
                const latestActualHistoryIndex = (this.historyCounter - 1 + this.positionHistory.length) % this.positionHistory.length;
                // ターゲットとする履歴のインデックス
                const targetHistoryIndex = (latestActualHistoryIndex - desiredHistoryOffset + this.positionHistory.length) % this.positionHistory.length;
                targetEntry = this.positionHistory[targetHistoryIndex];
            } else {
                // 履歴がまだ十分に溜まっていない場合は、利用可能な最も古い履歴（配列の先頭）を使用
                targetEntry = this.positionHistory[0];
            }

            // フォールバック: 履歴が全くない、または何らかの理由で targetEntry が取れない場合
            if (!targetEntry) {
                targetEntry = { position: this.model.position, quaternion: this.model.quaternion };
            }

            let desiredPosition = targetEntry.position.clone();
            const desiredQuaternion = targetEntry.quaternion.clone();

            // 2. 左右のオフセットを適用 (ターゲットの向き基準)
            // i=0 (1体目) -> 右(+1), i=1 (2体目) -> 左(-1), i=2 (3体目) -> さらに右, i=3 (4体目) -> さらに左 ...
            const side = (i % 2 === 0) ? 1 : -1;
            // オプションが増えるごとに、左右の広がりを大きくする
            const sideOffsetAmount = OPTION_SIDE_OFFSET_BASE + Math.floor(i / 2) * OPTION_SIDE_OFFSET_INCREMENT;

            const targetRightVector = new THREE.Vector3(1, 0, 0); // ローカルX軸 (右)
            targetRightVector.applyQuaternion(targetEntry.quaternion); // ターゲットの回転を適用してワールド空間の右ベクトルに
            targetRightVector.normalize(); // 正規化

            desiredPosition.addScaledVector(targetRightVector, side * sideOffsetAmount);

            // 3. 先行オブジェクト (本体または前のオプション) との最小距離を考慮
            const referenceObjectPosition = previousTargetObject3D.position;
            const distanceToRef = desiredPosition.distanceTo(referenceObjectPosition);

            // 2体目以降のオプションについてのみ、先行オプションとの距離を考慮
            // (i > 0 は2体目以降であることを意味する)
            if (this.clones.length > 1 && i > 0) {
                if (distanceToRef < OPTION_MIN_DISTANCE_TO_PREVIOUS && distanceToRef > 0.01) { // 0.01は計算誤差対策
                    const directionFromRef = desiredPosition.clone().sub(referenceObjectPosition).normalize();
                    // 最小距離だけ離れた位置に再設定
                    desiredPosition.copy(referenceObjectPosition).addScaledVector(directionFromRef, OPTION_MIN_DISTANCE_TO_PREVIOUS);
                }
            }


            // 4. 現在位置からターゲット位置へ滑らかに移動・回転
            // 追従速度に delta を乗算することでフレームレート変動の影響を多少抑える（係数調整は必要）
            // 60FPSを基準として、delta が 1/60 の時に OPTION_FOLLOW_SPEED となるように調整
            const followSpeedFactor = Math.min(1, OPTION_FOLLOW_SPEED * (delta * 60));
            clone.position.lerp(desiredPosition, followSpeedFactor);
            clone.quaternion.slerp(desiredQuaternion, followSpeedFactor);


            previousTargetObject3D = clone; // 次のオプションはこのクローンを基準にする
        }
    }

    disposeClone(clone) {
        if (!clone) return;
        if (clone.userData.mixer) {
            clone.userData.mixer.stopAllAction();
            // ミキサーやアクションの明示的なdisposeはThree.jsにはない。参照を切る。
            // delete clone.userData.mixer;
            // delete clone.userData.actions;
        }
        clone.traverse(object => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => { if (mat.map) mat.map.dispose(); mat.dispose(); });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                }
            }
        });
    }

    dispose() {
        if (this.mixer) {
            this.mixer.removeEventListener('finished', this._onAnimationFinished.bind(this));
            this.mixer.stopAllAction();
        }
        this.clones.forEach(clone => {
            if (this.scene && this.scene.children.includes(clone)) { // シーンから削除
                this.scene.remove(clone);
            }
            this.disposeClone(clone);
        });
        this.clones = [];
        // 本体モデルの解放は、Characterインスタンスが不要になった際に呼び出し元(Game.jsなど)で行うのが一般的
        // AssetLoaderがロードしたoriginalModelSourceはAssetLoaderが解放責務を持つ想定
    }
}