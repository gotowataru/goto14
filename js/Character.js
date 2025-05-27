// Character.js
import * as THREE from 'three';
import {
    CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS,
    CHARACTER_FRICTION, CHARACTER_RESTITUTION,
// ★★★ ↓このコメントをGeminiが勝手に消すので注意！ Fixed, DO NOT CHANGE - Gemini ★★★
//     // ジャンプ関連の定数をインポート 残す。
//     CHARACTER_JUMP_FORCE, // または CHARACTER_JUMP_INITIAL_VELOCITY
//     CHARACTER_MAX_JUMPS,
} from './constants.js';

export class Character {
    constructor(model, animations, scene, physicsManager, initialPosition, initialScale, localForwardVec, projectileManager) {

        this.model = model;
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.projectileManager = projectileManager;
        this.localForwardDirection = localForwardVec.clone();

        this.model.scale.setScalar(initialScale);
        this.scene.add(this.model);

        this.mixer = new THREE.AnimationMixer(this.model);
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
        this.isGrounded = true;

        this._setupAnimations(animations);
        this._createPhysicsBody(initialPosition, CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS);

        this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
    }

    _setupAnimations(animationClips) {
        for (const name in animationClips) {
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
                } else {
                    this.actions[name].setLoop(THREE.LoopOnce);
                    this.actions[name].clampWhenFinished = true;
                }
            } else {
                console.warn(`Character._setupAnimations: Animation clip for "${name}" is not a valid THREE.AnimationClip or is missing. Received:`, clip);
            }
        }
        if (this.actions['idle']) {
            this.switchAnimation('idle');
        } else {
            console.error("Character._setupAnimations: 'idle' animation action not found. Cannot set initial animation.");
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
            initialPosition,
            height,
            radius,
            mass,
            playerPhysicsProperties
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
            this.onAnimationFinishedCallback(finishedActionName);
        }
    }

    switchAnimation(name, crossFadeDuration = 0.2) {
        if (!this.mixer || !this.actions[name]) {
            return;
        }
        if(this.currentActionName === name && (name === 'idle' || name === 'run')) return;

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

        if (name === 'kick') {
            this.canPlayAction = false;
            this.kickActionStartTime = performance.now();
            this.beamGeneratedDuringKick = false;
        } else {
            this.kickActionStartTime = null;
        }
    }

    update(delta, inputManager, camera, speed, rotationSpeed) {
        if (!this.model || !this.mixer || !this.physicsBody) return;

        let disableMovementInput = false;
        if (this.currentActionName === 'kick' && this.actions['kick'] && this.actions['kick'].isRunning()) {
            disableMovementInput = true;
　　　　}

        const moveF = inputManager.isPhysicalKeyPressed('KeyW') || inputManager.isPhysicalKeyPressed('ArrowUp');
        const moveB = inputManager.isPhysicalKeyPressed('KeyS') || inputManager.isPhysicalKeyPressed('ArrowDown');
        const moveL = inputManager.isPhysicalKeyPressed('KeyA') || inputManager.isPhysicalKeyPressed('ArrowLeft');
        const moveR = inputManager.isPhysicalKeyPressed('KeyD') || inputManager.isPhysicalKeyPressed('ArrowRight');

        this.isMoving = false;
        this.moveDirection.set(0, 0, 0);
        let targetSpeed = 0;
        const effectiveSpeed = speed;

        if (!disableMovementInput) {
            const isTryingToMove = moveF || moveB || moveL || moveR;
            if (isTryingToMove) {
                this.isMoving = true;
                camera.getWorldDirection(this.cameraDirection);
                this.cameraDirection.y = 0;
                this.cameraDirection.normalize();
                const rightDirection = new THREE.Vector3().crossVectors(this.cameraDirection, camera.up).normalize();

                if (moveF) this.moveDirection.add(this.cameraDirection);
                if (moveB) this.moveDirection.sub(this.cameraDirection);
                if (moveL) this.moveDirection.sub(rightDirection);
                if (moveR) this.moveDirection.add(rightDirection);

                if (this.moveDirection.lengthSq() > 0) {
                    this.moveDirection.normalize();
                    targetSpeed = effectiveSpeed;
                    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(this.localForwardDirection, this.moveDirection);
                    this.model.quaternion.slerp(targetQuaternion, rotationSpeed * delta * 5.0);
                }
            }
        }

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
         } else if (actualHorizontalSpeed > speed * 0.01) {
             targetAnimation = 'run';
         } else {
             targetAnimation = 'idle';
         }

         if (this.currentActionName !== targetAnimation && this.actions[targetAnimation]) {
             this.switchAnimation(targetAnimation);
         } else if (!this.actions[targetAnimation] && targetAnimation !== 'kick') {
              console.warn(`Character.update: Target animation "${targetAnimation}" does not exist.`);
         }

         this.mixer.update(delta);
     }

    syncPhysicsToModel(tempTransform, characterHeight) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                this.model.position.set(p.x(), p.y() - characterHeight / 2, p.z());
            }
        }
    }

    startKickAction() {
        if (this.canPlayAction) {
            this.switchAnimation('kick');
            return true;
        }
        return false;
    }
}