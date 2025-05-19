// PhysicsManager.js
import * as THREE from 'three';
import {
    CHARACTER_FRICTION, CHARACTER_RESTITUTION,
    WALL_FRICTION, WALL_RESTITUTION,
    // 必要に応じてキャラクターの衝突グループ/マスク用の定数を追加
    // CHARACTER_COLLISION_GROUP, WORLD_COLLISION_MASKなど
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

    // ★★★ isInitialized メソッドを追加 ★★★
    isInitialized() {
        return !!(this.AmmoAPI && this.physicsWorld); // AmmoAPI と physicsWorld の両方が存在すれば true
    }
    // ★★★ 追加ここまで ★★★



    async initAmmo() {
        return new Promise((resolve, reject) => {
            const checkAmmoGlobal = () => {
                if (typeof Ammo === 'function') {
                    Ammo().then((ammoInstance) => {
                        this.AmmoAPI = ammoInstance;
                        this.tempTransform = new this.AmmoAPI.btTransform(); // Ammo初期化後に生成
                        console.log("Ammo.js (WASM) initialized by PhysicsManager.");
                        resolve();
                    }).catch(error => {
                        console.error("Error initializing Ammo.js (WASM) module:", error);
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
        // initAmmoで初期化済みのはずなので、ここでの再生成ロジックは基本的に不要
        if (!this.tempTransform && this.AmmoAPI) {
             this.tempTransform = new this.AmmoAPI.btTransform();
        }
        return this.tempTransform;
    }

    initPhysicsWorld() {
        if (!this.AmmoAPI) {
            console.error("AmmoAPI not initialized. Cannot init physics world.");
            return;
        }
        this.collisionConfiguration = new this.AmmoAPI.btDefaultCollisionConfiguration();
        this.dispatcher = new this.AmmoAPI.btCollisionDispatcher(this.collisionConfiguration);
        this.broadphase = new this.AmmoAPI.btDbvtBroadphase();
        this.solver = new this.AmmoAPI.btSequentialImpulseConstraintSolver();
        this.physicsWorld = new this.AmmoAPI.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
        this.physicsWorld.setGravity(new this.AmmoAPI.btVector3(0, this.GRAVITY_CONSTANT, 0));
        console.log("Ammo.js Physics world initialized by PhysicsManager.");
    }

    stepSimulation(deltaTime, maxSubSteps = 10, fixedTimeStep = 1 / 60) { // デフォルト値設定
        if (this.physicsWorld) {
            this.physicsWorld.stepSimulation(deltaTime, maxSubSteps, fixedTimeStep);
        }
    }

    addRigidBodyToWorld(body, group = 1, mask = -1) { // 衝突グループとマスクの引数を追加 (デフォルトは全てと衝突)
        this.physicsWorld.addRigidBody(body, group, mask);
        this.rigidBodies.push(body); // 管理リストに追加
    }

    createCharacterPhysicsBody(initialPosition, characterHeight, characterRadius, characterMass) {
        if (!this.AmmoAPI || !this.physicsWorld) return null;

        const capsuleRadius = characterRadius;
        const capsuleCylinderHeight = Math.max(0.01, characterHeight - (2 * capsuleRadius)); // 高さが0にならないように
        const shape = new this.AmmoAPI.btCapsuleShape(capsuleRadius, capsuleCylinderHeight);

        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();
        // カプセルの原点は、カプセルの幾何学的中心。キャラクターモデルの原点が足元の場合、
        // 物理カプセルの中心は (pos.y + capsuleCylinderHeight/2 + capsuleRadius) または (pos.y + characterHeight/2)
        // Character.jsのsyncPhysicsToModelでモデル位置を調整しているので、
        // ここでは物理ボディの中心を initialPosition.y + characterHeight / 2 に合わせる
        transform.setOrigin(new this.AmmoAPI.btVector3(initialPosition.x, initialPosition.y + characterHeight / 2, initialPosition.z));

        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        if (characterMass > 0) shape.calculateLocalInertia(characterMass, localInertia);
        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);
        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(characterMass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setActivationState(4); // DISABLE_DEACTIVATION
        body.setAngularFactor(new this.AmmoAPI.btVector3(0, 1, 0));
        body.setFriction(CHARACTER_FRICTION);
        body.setRestitution(CHARACTER_RESTITUTION);
        // body.setCollisionFlags(body.getCollisionFlags() | SomeFlag); // 必要なら特定のフラグ

        // キャラクター用の衝突グループとマスクを設定 (例)
        // const CHARACTER_GROUP = 1; // constants.js で定義
        // const WORLD_GROUP = 2;    // constants.js で定義
        // const SPHERE_GROUP = 4;   // constants.js で定義
        // this.addRigidBodyToWorld(body, CHARACTER_GROUP, WORLD_GROUP | SPHERE_GROUP); // ワールドと球とのみ衝突
        this.addRigidBodyToWorld(body); // デフォルトは全てと衝突

        return body;
    }

    createWallPhysicsBody(wallMesh, isSlope = false) {
        if (!this.AmmoAPI || !this.physicsWorld) return null;
        wallMesh.updateMatrixWorld(true); // 最新のワールド変換を適用

        let shape;
        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();

        if (isSlope) {
            const triangleMesh = new this.AmmoAPI.btTriangleMesh(true, true); // use32bitIndices, use4componentVertices (通常true,trueでOK)
            const geometry = wallMesh.geometry;

            if (!geometry.index) {
                console.warn("Slope mesh is not indexed. Trying to create non-indexed triangle mesh. This might be less efficient or fail.", wallMesh.name);
                // 非インデックスジオメトリからbtTriangleMeshを作るのは複雑か、サポート外の可能性。
                // Indexed BufferGeometryを使うのが基本。
                // ここではフォールバックとしてボックス形状を使う（あるいはエラー終了）
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
                const vec1 = new this.AmmoAPI.btVector3(0,0,0); // 再利用してメモリ確保を減らす
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
                    triangleMesh.addTriangle(vec1, vec2, vec3, false); // removeDuplicateVertices = false
                }
                shape = new this.AmmoAPI.btBvhTriangleMeshShape(triangleMesh, true); // useQuantizedAabbCompression = true
                // btBvhTriangleMeshShapeの場合、頂点がワールド座標で定義されているため、
                // 剛体のtransformは単位行列（位置(0,0,0)、回転なし）とするのが一般的
                // (上記のコードでは頂点をワールド座標に変換しているため)
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
            wallMesh.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); // position, quaternion, scale
            transform.setRotation(new this.AmmoAPI.btQuaternion(q.x, q.y, q.z, q.w));
        }

        const mass = 0; // 静的オブジェクト
        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);
        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setFriction(WALL_FRICTION); // isSlope であれば SLOPE_FRICTION を使うなども可能
        body.setRestitution(WALL_RESTITUTION);
        body.setCollisionFlags(body.getCollisionFlags() | 2); // CF_STATIC_OBJECT
        body.setActivationState(4); // DISABLE_DEACTIVATION

        this.addRigidBodyToWorld(body); // ワールドへの追加と管理リストへの登録
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

    /**
     * 箱型の剛体を作成します。
     * @param {THREE.Object3D} threeObject - 関連付けるThree.jsオブジェクト
     * @param {THREE.Vector3} halfExtents - 箱の各辺の半分の長さ (中心からの距離)
     * @param {number} mass - 質量 (0の場合は静的オブジェクト)
     * @param {number} friction - 摩擦係数
     * @param {number} restitution - 反発係数
     * @param {boolean} [isKinematic=false] - キネマティックボディにするか
     * @param {THREE.Vector3} [offset=new THREE.Vector3(0,0,0)] - Three.jsオブジェクトの中心と物理ボディの中心のオフセット
     * @returns {Ammo.btRigidBody | null} 作成された Ammo.btRigidBody、または失敗した場合は null
     */
    createBoxPhysicsBody(threeObject, halfExtents, mass, friction, restitution, isKinematic = false, offset = new THREE.Vector3(0,0,0)) {
        if (!this.AmmoAPI || !this.physicsWorld) {
            console.error("PhysicsManager: AmmoAPIまたはPhysicsWorldが初期化されていません。Cannot create box physics body.");
            return null;
        }

        // Three.jsオブジェクトのワールド座標と回転を取得
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        threeObject.getWorldPosition(worldPosition);
        threeObject.getWorldQuaternion(worldQuaternion);

        // オフセットを適用
        const physicsPosition = worldPosition.clone().add(offset);

        const transform = new this.AmmoAPI.btTransform();
        transform.setIdentity();
        transform.setOrigin(new this.AmmoAPI.btVector3(physicsPosition.x, physicsPosition.y, physicsPosition.z));
        transform.setRotation(new this.AmmoAPI.btQuaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w));

        const motionState = new this.AmmoAPI.btDefaultMotionState(transform);

        // 箱の形状を作成
        const shape = new this.AmmoAPI.btBoxShape(new this.AmmoAPI.btVector3(halfExtents.x, halfExtents.y, halfExtents.z));
        const collisionMargin = 0.05; // 適切な値を設定
        shape.setMargin(collisionMargin);

        const localInertia = new this.AmmoAPI.btVector3(0, 0, 0);
        if (mass > 0 && !isKinematic) { // 動的ボディの場合のみ慣性を計算
            shape.calculateLocalInertia(mass, localInertia);
        }

        const rbInfo = new this.AmmoAPI.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.AmmoAPI.btRigidBody(rbInfo);

        body.setFriction(friction);
        body.setRestitution(restitution);

        if (isKinematic) {
            body.setCollisionFlags(body.getCollisionFlags() | 2); // CF_KINEMATIC_OBJECT
            body.setActivationState(4); // DISABLE_DEACTIVATION (キネマティックボディは常にアクティブ)
        } else if (mass === 0) { // 静的オブジェクトの場合
            // 静的オブジェクトのフラグは addRigidBodyToWorld で設定されるか、
            // ここで明示的に設定しても良い。createWallPhysicsBody を参考に。
            // 現状の createWallPhysicsBody では CF_STATIC_OBJECT (フラグ値2) を設定しているので、
            // ここでは質量0なら静的と見なすのが自然。
            // ただし、キネマティックも質量0で定義されることがあるので、isKinematic を優先。
            body.setCollisionFlags(body.getCollisionFlags() | 1); // CF_STATIC_OBJECT (Ammo.jsの定義による)
                                                                // 通常はCF_STATIC_OBJECT = 1、CF_KINEMATIC_OBJECT = 2
                                                                // createWallPhysicsBody では 2 (CF_STATIC_OBJECT) を使用している点に注意。
                                                                // Ammo.jsのドキュメントや btCollisionObject.h を確認して正しいフラグを使う
                                                                // 一般的には CF_STATIC_OBJECT は 1, KINEMATIC は 2
                                                                // createWallPhysicsBodyのフラグ設定が CF_KINEMATIC_OBJECT になっている可能性があるので注意
                                                                // → 確認したところ、あなたの createWallPhysicsBody は `body.setCollisionFlags(body.getCollisionFlags() | 2);` となっており、
                                                                //   これは通常 `CF_KINEMATIC_OBJECT` です。静的な壁であれば `CF_STATIC_OBJECT` (通常は1) が適切です。
                                                                //   ここでは、mass = 0 かつ isKinematic = false の場合に CF_STATIC_OBJECT を設定します。
            if (!isKinematic) { // isKinematic でない質量0のオブジェクトは静的
                 body.setCollisionFlags(body.getCollisionFlags() | 1); // CF_STATIC_OBJECT
            }
        }

        // オプション: Three.jsオブジェクトを物理ボディに関連付ける (raycastなどで使用)
        body.threeMesh = threeObject; // PhysicsManager.findMeshByBodyPtr で使うために直接参照を保持

        this.addRigidBodyToWorld(body); // ワールドへの追加と管理リストへの登録

        if (mass > 0 && !isKinematic) { // 動的オブジェクトのみアクティベーションを考慮
             body.activate(); // スリープ状態になるのを防ぐため、初期状態でアクティブにする
        }

        console.log(`Box physics body created for ${threeObject.name || 'Unnamed Object'} with mass: ${mass}, kinematic: ${isKinematic}`);
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
                // ★★★ ここから修正 ★★★
                let successfullyDestroyedMeshInterface = false;
                try {
                    // まず、btBvhTriangleMeshShape にキャストを試みる
                    const bvhShape = this.AmmoAPI.castObject(collisionShape, this.AmmoAPI.btBvhTriangleMeshShape);

                    if (bvhShape) {
                        // キャストが成功した場合 (つまり、AmmoがこれをbtBvhTriangleMeshShapeとして認識した場合)
                        // さらに getMeshInterface メソッドが存在するか確認
                        if (typeof bvhShape.getMeshInterface === 'function') {
                            console.log("PhysicsManager.removeRigidBody: Shape identified as btBvhTriangleMeshShape with getMeshInterface. Attempting to destroy meshInterface.");
                            const meshInterface = bvhShape.getMeshInterface();
                            if (meshInterface) {
                                this.AmmoAPI.destroy(meshInterface);
                                console.log("PhysicsManager.removeRigidBody: Destroyed meshInterface.");
                                successfullyDestroyedMeshInterface = true;
                            } else {
                                console.log("PhysicsManager.removeRigidBody: getMeshInterface() returned null/undefined.");
                            }
                        } else {
                            // console.log("PhysicsManager.removeRigidBody: Cast to btBvhTriangleMeshShape successful, but getMeshInterface is not a function. Shape might be a related concave type without a direct mesh interface to destroy this way.");
                        }
                    } else {
                        // console.log("PhysicsManager.removeRigidBody: Cast to btBvhTriangleMeshShape failed. Assuming not a btBvhTriangleMeshShape requiring special meshInterface destruction.");
                    }
                } catch (e) {
                    // castObject や getMeshInterface で予期せぬエラーが発生した場合のフォールバック
                    console.warn("PhysicsManager.removeRigidBody: Error during special shape destruction (e.g., meshInterface). Proceeding with normal shape destruction. Error:", e);
                }
                // ★★★ 修正ここまで ★★★

                // 通常のコリジョンシェイプの破棄は必ず行う
                this.AmmoAPI.destroy(collisionShape);
                // console.log("PhysicsManager.removeRigidBody: Destroyed collisionShape itself.");
            }
        } else {
            console.warn("PhysicsManager.removeRigidBody: Attempted to remove body but physicsWorld, body, or AmmoAPI is not available.");
        }
    }

    // レイキャスト機能
    raycast(rayFromWorld, rayToWorld, options = {}) {
        if (!this.AmmoAPI || !this.physicsWorld) return { hasHit: false };

        const {
            ignoreRigidBody = null, // 無視するbtRigidBody
            collisionFilterGroup = -1, // Ammo.btBroadphaseProxy. તમામグループと衝突 (デフォルト)
            collisionFilterMask = -1,  // Ammo.btBroadphaseProxy. તમામマスクと衝突 (デフォルト)
        } = options;

        const rayFrom = new this.AmmoAPI.btVector3(rayFromWorld.x, rayFromWorld.y, rayFromWorld.z);
        const rayTo = new this.AmmoAPI.btVector3(rayToWorld.x, rayToWorld.y, rayToWorld.z);
        const rayCallback = new this.AmmoAPI.ClosestRayResultCallback(rayFrom, rayTo);

        // 衝突フィルタリング設定
        rayCallback.set_m_collisionFilterGroup(collisionFilterGroup);
        rayCallback.set_m_collisionFilterMask(collisionFilterMask);

        // 特定のリジッドボディを無視する (ClosestRayResultCallback にはそのための直接的なフラグはないので、
        // フィルタグループ/マスクで対応するか、コールバック内で判定する必要がある。
        // ここでは、コールバック内で無視する簡易的な方法を示す。より良いのはフィルタグループ。)
        // もし ignoreRigidBody が指定された場合、そのボディのポインタを保持しておく
        let ignoreCollisionObject = null;
        if (ignoreRigidBody) {
            ignoreCollisionObject = ignoreRigidBody.a; // Ammo.js の btRigidBody はラッパーなので、実際のポインタは .a にあることが多い
        }


        // ClosestRayResultCallbackをカスタマイズして特定のボディを無視する例
        // (ただし、これはAmmo.jsのビルドやバインディングによっては動作が異なる可能性あり、通常はフィルタグループ推奨)
        // const originalNeedsCollision = rayCallback.needsCollision.bind(rayCallback);
        // rayCallback.needsCollision = (proxy0) => {
        //    if (ignoreRigidBody && proxy0.get_m_collisionObject() === ignoreRigidBody.a) { // .a はbtCollisionObjectポインタ
        //        return false;
        //    }
        //    return originalNeedsCollision(proxy0);
        // };

        this.physicsWorld.rayTest(rayFrom, rayTo, rayCallback);
        let result = { hasHit: false };

        if (rayCallback.hasHit()) {
            const hitPoint = rayCallback.get_m_hitPointWorld();
            const hitNormal = rayCallback.get_m_hitNormalWorld();
            const collisionObject = rayCallback.get_m_collisionObject(); // btCollisionObjectのポインタ (型付き)

            // 指定されたボディを無視する処理 (フィルタリングが理想だが、ここで最終チェック)
            if (ignoreCollisionObject && collisionObject.a === ignoreCollisionObject) { // .a で実際のポインタ比較
                // 無視対象だったのでヒットしなかったことにする
                // (実際には、より遠い次のヒットを探す必要があるが、ClosestRayResultCallbackでは難しい)
                // この場合、AllHitsRayResultCallback を使うか、フィルタリングを厳密に行う。
                // ここでは簡易的に「無視対象ならヒットなし」とする。
            } else {
                const actualBody = this.AmmoAPI.btRigidBody.prototype.upcast(collisionObject);
                // Three.js のメッシュを取得するには、作成時に userData に関連付けておく必要がある
                const hitMesh = collisionObject.getCollisionFlags() === 2 ? null : this.findMeshByBodyPtr(collisionObject.a); // CF_STATIC_OBJECT は mesh を持たない想定

                result = {
                    hasHit: true,
                    point: new THREE.Vector3(hitPoint.x(), hitPoint.y(), hitPoint.z()),
                    normal: new THREE.Vector3(hitNormal.x(), hitNormal.y(), hitNormal.z()),
                    colliderBody: actualBody, // btRigidBody
                    colliderMesh: hitMesh     // THREE.Mesh (userDataなどから引く)
                };
            }
        }

        this.AmmoAPI.destroy(rayCallback);
        this.AmmoAPI.destroy(rayFrom);
        this.AmmoAPI.destroy(rayTo);
        return result;
    }

    // (ヘルパー) 物理ボディのポインタからThree.jsメッシュを見つける (要実装)
    findMeshByBodyPtr(bodyPtr) {
        // PhysicsManagerで剛体とメッシュの対応を管理するか、
        // 各btRigidBodyのuserDataにTHREE.MeshのIDや参照を保存しておく必要がある。
        // 例: this.rigidBodies をイテレートして body.a === bodyPtr となるものを探し、
        //     そのボディに関連付けられたメッシュを返す。
        for (const body of this.rigidBodies) {
            if (body.a === bodyPtr && body.threeMesh) { // body.threeMesh は独自に追加したプロパティ
                return body.threeMesh;
            }
        }
        return null;
    }


    destroy() {
        if (!this.AmmoAPI) return;
        // ワールド内のすべてのリジッドボディを削除
        for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
            this.removeRigidBody(this.rigidBodies[i]); // removeRigidBody内でリストからも削除される
        }
        this.rigidBodies = []; //念のため空にする

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
        console.log("PhysicsManager resources destroyed.");
    }
}