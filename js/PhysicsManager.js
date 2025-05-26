// PhysicsManager.js
import * as THREE from 'three';
import {
    CHARACTER_FRICTION, CHARACTER_RESTITUTION,
    WALL_FRICTION, WALL_RESTITUTION,
} from './constants.js';

export class PhysicsManager {
    constructor(gravityConstant) {
        this.AmmoAPI = null;
        this.physicsWorld = null;
        this.tempTransform = null; // btTransformインスタンス
        this.GRAVITY_CONSTANT = gravityConstant;
        this.collisionConfiguration = null;
        this.dispatcher = null;
        this.broadphase = null;
        this.solver = null;
        this.rigidBodies = []; // ワールドに追加されたリジッドボディを管理
    }

    isInitialized() {
        return !!(this.AmmoAPI && this.physicsWorld); // AmmoAPI と physicsWorld の両方が存在すれば true
    }

    async initAmmo() {
        return new Promise((resolve, reject) => {
            const checkAmmoGlobal = () => {
                if (typeof Ammo === 'function') {
                    Ammo().then((ammoInstance) => {
                        this.AmmoAPI = ammoInstance;
                        this.tempTransform = new this.AmmoAPI.btTransform(); // Ammo初期化後に生成
                        console.log("PhysicsManager: Ammo.js (WASM) initialized.");
                        resolve();
                    }).catch(error => {
                        console.error("PhysicsManager: Error initializing Ammo.js (WASM) module:", error);
                        reject(error);
                    });
                } else {
                    setTimeout(checkAmmoGlobal, 50);
                }
            };
            checkAmmoGlobal();
        });
    }

    getTempTransform() {
        if (!this.tempTransform && this.AmmoAPI) {
             this.tempTransform = new this.AmmoAPI.btTransform();
        }
        return this.tempTransform;
    }

    initPhysicsWorld() {
        if (!this.AmmoAPI) {
            console.error("PhysicsManager: AmmoAPI not initialized. Cannot init physics world.");
            return;
        }
        this.collisionConfiguration = new this.AmmoAPI.btDefaultCollisionConfiguration();
        this.dispatcher = new this.AmmoAPI.btCollisionDispatcher(this.collisionConfiguration);
        this.broadphase = new this.AmmoAPI.btDbvtBroadphase();
        this.solver = new this.AmmoAPI.btSequentialImpulseConstraintSolver();
        this.physicsWorld = new this.AmmoAPI.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
        this.physicsWorld.setGravity(new this.AmmoAPI.btVector3(0, this.GRAVITY_CONSTANT, 0));
        console.log("PhysicsManager: Ammo.js Physics world initialized.");
        console.log(`PhysicsManager: Gravity set to Y=${this.GRAVITY_CONSTANT}`);
    }

    stepSimulation(deltaTime, maxSubSteps = 10, fixedTimeStep = 1 / 60) {
        if (this.physicsWorld) {
            this.physicsWorld.stepSimulation(deltaTime, maxSubSteps, fixedTimeStep);
        }
    }

    addRigidBodyToWorld(body, group = 1, mask = -1) {
        this.physicsWorld.addRigidBody(body, group, mask);
        this.rigidBodies.push(body); // 管理リストに追加

        // 静的ボディ (質量0) に対して getMass() を呼び出すとエラーになるため、安全な条件付きに
        let massInfo = 'N/A';
        if (typeof body.getMass === 'function') { // Ammo.jsのボディにgetMassが定義されているかチェック
            const mass = body.getMass();
            if (mass > 0) {
                massInfo = mass.toFixed(2);
            } else {
                if (body.getCollisionFlags() & this.AmmoAPI.CF_STATIC_OBJECT) {
                    massInfo = '0 (Static)';
                } else if (body.getCollisionFlags() & this.AmmoAPI.CF_KINEMATIC_OBJECT) {
                    massInfo = '0 (Kinematic)';
                } else {
                    massInfo = '0';
                }
            }
        }
        console.log(`PhysicsManager: Added rigid body to world. Total rigid bodies: ${this.rigidBodies.length}. Mass: ${massInfo}.`);
    }

    /**
     * キャラクター用のカプセル型物理ボディを作成します。
     * @param {THREE.Vector3} initialPosition - 初期位置 (足元)
     * @param {number} characterHeight - キャラクターの高さ
     * @param {number} characterRadius - キャラクターの半径
     * @param {number} characterMass - キャラクターの質量
     * @returns {Ammo.btRigidBody | null} 作成された物理ボディ
     */
    createCharacterPhysicsBody(initialPosition, characterHeight, characterRadius, characterMass) { // ★ 引数を元の形に戻す
        if (!this.AmmoAPI || !this.physicsWorld) {
            console.error("PhysicsManager: AmmoAPI or PhysicsWorld not initialized. Cannot create character physics body.");
            return null;
        }

        const capsuleRadius = characterRadius;
        // Ammo.jsのbtCapsuleShape(radius, height) の height は「円柱部分の高さ」なので、
        // 全体のカプセル高さから両端の半球半径2つ分を引く必要があります。
        const capsuleCylinderHeight = Math.max(0.01, characterHeight - (2 * capsuleRadius)); // 高さが0にならないように

        const shape = new this.AmmoAPI.btCapsuleShape(capsuleRadius, capsuleCylinderHeight);

        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();

        // 物理ボディの原点は、モデルの足元から半分の高さ (重心) に設定
        transform.setOrigin(new this.AmmoAPI.btVector3(initialPosition.x, initialPosition.y + characterHeight / 2, initialPosition.z));
        
        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        if (characterMass > 0) shape.calculateLocalInertia(characterMass, localInertia);

        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);
        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(characterMass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setActivationState(4); // DISABLE_DEACTIVATION (常にアクティブに保つ)
        body.setAngularFactor(new this.AmmoAPI.btVector3(0, 1, 0)); // Y軸回転のみ許可
        body.setFriction(CHARACTER_FRICTION); // constantsから取得
        body.setRestitution(CHARACTER_RESTITUTION); // constantsから取得

        this.addRigidBodyToWorld(body); // デフォルトは全てと衝突
        return body;
    }

    createWallPhysicsBody(wallMesh, isSlope = false) {
        if (!this.AmmoAPI || !this.physicsWorld) return null;
        wallMesh.updateMatrixWorld(true);

        let shape;
        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();

        if (isSlope) {
            const triangleMesh = new this.AmmoAPI.btTriangleMesh(true, true);
            const geometry = wallMesh.geometry;

            if (!geometry.index) {
                console.warn("PhysicsManager: Slope mesh is not indexed. Trying to create non-indexed triangle mesh. This might be less efficient or fail.", wallMesh.name);

                const box = new THREE.Box3().setFromObject(wallMesh);
                const size = new THREE.Vector3();
                box.getSize(size);
                shape = new this.AmmoAPI.btBoxShape(new this.AmmoAPI.btVector3(size.x / 2, size.y / 2, size.z / 2));
                const center = new THREE.Vector3();
                box.getCenter(center);
                transform.setOrigin(new this.AmmoAPI.btVector3(center.x, center.y, center.z));
                const q = new THREE.Quaternion();
                wallMesh.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
                transform.setRotation(new this.AmmoAPI.btQuaternion(q.x, q.y, q.z, q.w));
            } else {
                const vertices = geometry.attributes.position.array;
                const indices = geometry.index.array;
                const numTriangles = indices.length / 3;
                const vec1 = new this.AmmoAPI.btVector3(0,0,0);
                const vec2 = new this.AmmoAPI.btVector3(0,0,0);
                const vec3 = new this.AmmoAPI.btVector3(0,0,0);

                for (let i = 0; i < numTriangles; i++) {
                    const i0 = indices[i * 3];
                    const i1 = indices[i * 3 + 1];
                    const i2 = indices[i * 3 + 2];

                    const p0 = new THREE.Vector3(vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]).applyMatrix4(wallMesh.matrixWorld);
                    const p1 = new THREE.Vector3(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]).applyMatrix4(wallMesh.matrixWorld);
                    const p2 = new THREE.Vector3(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]).applyMatrix4(wallMesh.matrixWorld);

                    vec1.setValue(p0.x, p0.y, p0.z);
                    vec2.setValue(p1.x, p1.y, p1.z);
                    vec3.setValue(p2.x, p2.y, p2.z);
                    triangleMesh.addTriangle(vec1, vec2, vec3, false);
                }
                shape = new this.AmmoAPI.btBvhTriangleMeshShape(triangleMesh, true);
            }
        } else { // 通常の壁 (ボックス形状)
            const box = new THREE.Box3().setFromObject(wallMesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            shape = new this.AmmoAPI.btBoxShape(new this.AmmoAPI.btVector3(size.x / 2, size.y / 2, size.z / 2));
            const center = new THREE.Vector3();
            box.getCenter(center);
            transform.setOrigin(new this.AmmoAPI.btVector3(center.x, center.y, center.z));
            const q = new THREE.Quaternion();
            wallMesh.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
            transform.setRotation(new this.AmmoAPI.btQuaternion(q.x, q.y, q.z, q.w));
        }

        const mass = 0; // 静的オブジェクト
        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);
        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setFriction(WALL_FRICTION); 
        body.setRestitution(WALL_RESTITUTION);
        body.setCollisionFlags(body.getCollisionFlags() | this.AmmoAPI.CF_STATIC_OBJECT); // 静的オブジェクトフラグを設定
        body.setActivationState(4); // DISABLE_DEACTIVATION

        this.addRigidBodyToWorld(body);
        return body;
    }

    createSpherePhysicsBody(sphereMesh, radius, sphereMass, sphereFriction, sphereRestitution) {
        if (!this.AmmoAPI || !this.physicsWorld) return null;
        const shape = new this.AmmoAPI.btSphereShape(radius);
        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();
        transform.setOrigin(new this.AmmoAPI.btVector3(sphereMesh.position.x, sphereMesh.position.y, sphereMesh.position.z));

        const mass = sphereMass;
        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        if (mass > 0) shape.calculateLocalInertia(mass, localInertia);
        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);
        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setFriction(sphereFriction);
        body.setRestitution(sphereRestitution);
        this.addRigidBodyToWorld(body);
        return body;
    }

    createBoxPhysicsBody(threeObject, halfExtents, mass, friction, restitution, isKinematic = false, offset = new THREE.Vector3(0,0,0)) {
        if (!this.AmmoAPI || !this.physicsWorld) {
            console.error("PhysicsManager: AmmoAPIまたはPhysicsWorldが初期化されていません。Cannot create box physics body.");
            return null;
        }

        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        threeObject.getWorldPosition(worldPosition);
        threeObject.getWorldQuaternion(worldQuaternion);

        const physicsPosition = worldPosition.clone().add(offset);

        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();
        transform.setOrigin(new this.AmmoAPI.btVector3(physicsPosition.x, physicsPosition.y, physicsPosition.z));
        transform.setRotation(new this.AmmoAPI.btQuaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w));

        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);

        const shape = new this.AmmoAPI.btBoxShape(new this.AmmoAPI.btVector3(halfExtents.x, halfExtents.y, halfExtents.z));
        const collisionMargin = 0.05;
        shape.setMargin(collisionMargin);

        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        if (mass > 0 && !isKinematic) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setFriction(friction);
        body.setRestitution(restitution);

        if (isKinematic) {
            body.setCollisionFlags(body.getCollisionFlags() | this.AmmoAPI.CF_KINEMATIC_OBJECT);
            body.setActivationState(4);
        } else if (mass === 0) {
            body.setCollisionFlags(body.getCollisionFlags() | this.AmmoAPI.CF_STATIC_OBJECT);
        }

        body.threeMesh = threeObject;

        this.addRigidBodyToWorld(body);

        if (mass > 0 && !isKinematic) { 
             body.activate();
        }
        return body;
    }

    removeRigidBody(body) {
        if (this.physicsWorld && body && this.AmmoAPI) {
            const index = this.rigidBodies.indexOf(body);
            if (index > -1) {
                this.rigidBodies.splice(index, 1);
            }
            this.physicsWorld.removeRigidBody(body);

            const motionState = body.getMotionState();
            const collisionShape = body.getCollisionShape();

            this.AmmoAPI.destroy(body);
            if (motionState) {
                this.AmmoAPI.destroy(motionState);
            }

            if (collisionShape) {
                try {
                    const bvhShape = this.AmmoAPI.castObject(collisionShape, this.AmmoAPI.btBvhTriangleMeshShape);
                    if (bvhShape && typeof bvhShape.getMeshInterface === 'function') {
                        const meshInterface = bvhShape.getMeshInterface();
                        if (meshInterface) {
                            this.AmmoAPI.destroy(meshInterface);
                        }
                    }
                } catch (e) {
                    console.warn("PhysicsManager.removeRigidBody: Error during special shape destruction (e.g., meshInterface). Proceeding with normal shape destruction. Error:", e);
                }

                this.AmmoAPI.destroy(collisionShape);
            }
        } else {
            console.warn("PhysicsManager.removeRigidBody: Attempted to remove body but physicsWorld, body, or AmmoAPI is not available.");
        }
    }

    raycast(rayFromWorld, rayToWorld, options = {}) {
        if (!this.AmmoAPI || !this.physicsWorld) return { hasHit: false };

        const {
            ignoreRigidBody = null,
            collisionFilterGroup = 1,
            collisionFilterMask = -1,
        } = options;

        const rayFrom = new this.AmmoAPI.btVector3(rayFromWorld.x, rayFromWorld.y, rayFromWorld.z);
        const rayTo = new this.AmmoAPI.btVector3(rayToWorld.x, rayToWorld.y, rayToWorld.z);
        const rayCallback = new this.AmmoAPI.ClosestRayResultCallback(rayFrom, rayTo);

        rayCallback.set_m_collisionFilterGroup(collisionFilterGroup);
        rayCallback.set_m_collisionFilterMask(collisionFilterMask);

        let ignoreCollisionObject = null;
        if (ignoreRigidBody) {
            ignoreCollisionObject = ignoreRigidBody.a;
        }

        this.physicsWorld.rayTest(rayFrom, rayTo, rayCallback);
        let result = { hasHit: false };

        if (rayCallback.hasHit()) {
            const hitPoint = rayCallback.get_m_hitPointWorld();
            const hitNormal = rayCallback.get_m_hitNormalWorld();
            const collisionObject = rayCallback.get_m_collisionObject();

            if (ignoreCollisionObject && collisionObject.a === ignoreCollisionObject) { 
            } else {
                const actualBody = this.AmmoAPI.btRigidBody.prototype.upcast(collisionObject);
                const hitMesh = (collisionObject.getCollisionFlags() & this.AmmoAPI.CF_KINEMATIC_OBJECT) ? null : this.findMeshByBodyPtr(collisionObject.a);

                result = {
                    hasHit: true,
                    point: new THREE.Vector3(hitPoint.x(), hitPoint.y(), hitPoint.z()),
                    normal: new THREE.Vector3(hitNormal.x(), hitNormal.y(), hitNormal.z()),
                    colliderBody: actualBody,
                    colliderMesh: hitMesh
                };
            }
        }

        this.AmmoAPI.destroy(rayCallback);
        this.AmmoAPI.destroy(rayFrom);
        this.AmmoAPI.destroy(rayTo);
        return result;
    }

    findMeshByBodyPtr(bodyPtr) {
        for (const body of this.rigidBodies) {
            if (body.a === bodyPtr && body.threeMesh) {
                return body.threeMesh;
            }
        }
        return null;
    }

    destroy() {
        if (!this.AmmoAPI) return;
        console.log("PhysicsManager: Destroying resources...");
        for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
            this.removeRigidBody(this.rigidBodies[i]);
        }
        this.rigidBodies = [];

        if (this.physicsWorld) this.AmmoAPI.destroy(this.physicsWorld);
        if (this.solver) this.AmmoAPI.destroy(this.solver);
        if (this.broadphase) this.AmmoAPI.destroy(this.broadphase);
        if (this.dispatcher) this.AmmoAPI.destroy(this.dispatcher);
        if (this.collisionConfiguration) this.AmmoAPI.destroy(this.collisionConfiguration);
        if (this.tempTransform) this.AmmoAPI.destroy(this.tempTransform);

        this.physicsWorld = null;
        this.solver = null;
        this.broadphase = null;
        this.dispatcher = null;
        this.collisionConfiguration = null;
        this.tempTransform = null;
        console.log("PhysicsManager: Resources destroyed.");
    }
}