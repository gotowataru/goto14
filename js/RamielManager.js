// RamielManager.js
import * as THREE from 'three';
import {
    RAMIEL_SIZE, RAMIEL_CORE_RADIUS_FACTOR, RAMIEL_COLOR, RAMIEL_CORE_COLOR,
    RAMIEL_OPACITY, RAMIEL_METALNESS, RAMIEL_ROUGHNESS,
    RAMIEL_MASS, RAMIEL_FRICTION, RAMIEL_RESTITUTION, RAMIEL_INITIAL_Y_OFFSET
} from './constants.js';

export class RamielManager {
    constructor(scene, physicsManager, raycastTargetsArrayRef) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.raycastTargetsRef = raycastTargetsArrayRef; // Gameクラスが持つ配列への参照
        this.ramiels = []; // Three.js Mesh (本体とコア) と物理ボディのペアを管理 { mainMesh, coreMesh, body }
    }

    createRamiels(numRamiels, mazeModel) {
        if (!mazeModel) {
            console.warn("Maze model not available for Ramiel placement.");
            return;
        }
        const mazeBoundingBox = new THREE.Box3().setFromObject(mazeModel);
        const mazeSize = mazeBoundingBox.getSize(new THREE.Vector3());
        const mazeCenter = mazeBoundingBox.getCenter(new THREE.Vector3());

        for (let i = 0; i < numRamiels; i++) {
            const size = RAMIEL_SIZE; // 固定サイズとするか、ランダムにする場合は MIN/MAX を定数に追加
            const coreRadius = size * RAMIEL_CORE_RADIUS_FACTOR;

            // 正八面体のジオメトリとマテリアル
            const ramielGeometry = new THREE.OctahedronGeometry(size, 0); // detail 0 で通常の正八面体
            const ramielMaterial = new THREE.MeshStandardMaterial({
                color: RAMIEL_COLOR,
                metalness: RAMIEL_METALNESS,
                roughness: RAMIEL_ROUGHNESS,
                transparent: true,
                opacity: RAMIEL_OPACITY,
                // side: THREE.DoubleSide, // 内側も描画する場合
            });
            const ramielMesh = new THREE.Mesh(ramielGeometry, ramielMaterial);
            ramielMesh.castShadow = true;
            ramielMesh.receiveShadow = true;

            // 中心の光る球のジオメトリとマテリアル
            const coreGeometry = new THREE.SphereGeometry(coreRadius, 16, 16);
            const coreMaterial = new THREE.MeshBasicMaterial({
                color: RAMIEL_CORE_COLOR,
                toneMapped: false, // 発光感を出すため、シーンのトーンマッピングの影響を受けにくくする
            });
            const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
            coreMesh.position.set(0, 0, 0); // ramielMeshの中心に配置
            ramielMesh.add(coreMesh); // 正八面体の子オブジェクトにする

            // ランダムな位置 (迷路の範囲内、かつ地面から少し浮かせた高さ)
            const x = THREE.MathUtils.randFloat(mazeCenter.x - mazeSize.x / 2 * 0.7, mazeCenter.x + mazeSize.x / 2 * 0.7);
            const z = THREE.MathUtils.randFloat(mazeCenter.z - mazeSize.z / 2 * 0.7, mazeCenter.z + mazeSize.z / 2 * 0.7);
            const y = mazeBoundingBox.max.y + RAMIEL_INITIAL_Y_OFFSET + size; // サイズ分を考慮
            ramielMesh.position.set(x, y, z);
            ramielMesh.name = `Ramiel_${i}`;

            this.scene.add(ramielMesh);

            // 物理ボディを作成 (箱型)
            // 正八面体に外接する立方体の半分の辺の長さ (おおよそ)
            // OctahedronGeometryの半径は頂点までの距離なので、箱のサイズはそれより少し小さめでも良い
            const boxHalfExtents = new THREE.Vector3(size, size, size).multiplyScalar(0.707); // √2/2 ~= 0.707 で内接する立方体に近づけるか、単純にsize
            const physicsBody = this.physicsManager.createBoxPhysicsBody(
                ramielMesh,
                boxHalfExtents, // 箱の半分の XYZ サイズ
                RAMIEL_MASS,
                RAMIEL_FRICTION,
                RAMIEL_RESTITUTION,
                false // isKinematic: false (動的オブジェクト)
            );

            if (physicsBody) {
                // 物理ボディにユーザーポインターとしてメッシュをセットしておくと、衝突時に役立つことがある
                const btTransform = new Ammo.btTransform();
                physicsBody.getWorldTransform(btTransform);
                // btTransform.setRotation(new Ammo.btQuaternion(0,0,0,1)); // 回転を固定したい場合 (初期のみ)
                // physicsBody.setWorldTransform(btTransform);

                // 回転を抑制する (完全に転がらなくはならないが、転がりにくくはなる)
                physicsBody.setAngularFactor(new Ammo.btVector3(0.1, 0.1, 0.1)); // 回転しにくくする

                this.ramiels.push({ mainMesh: ramielMesh, coreMesh: coreMesh, body: physicsBody });
                this.raycastTargetsRef.push(ramielMesh); // ビーム衝突判定用に追加 (本体メッシュを対象とする)
            } else {
                this.scene.remove(ramielMesh);
                ramielGeometry.dispose();
                ramielMaterial.dispose();
                coreGeometry.dispose();
                coreMaterial.dispose();
            }
        }
        // console.log(`${this.ramiels.length} 個のラミエルを生成・配置しました (RamielManager).`);
    }

    isRamiel(object) {
        // mainMesh を比較対象とする
        return this.ramiels.some(r => r.mainMesh === object);
    }

    destroyRamielByMesh(ramielMainMesh) {
        const ramielIndex = this.ramiels.findIndex(r => r.mainMesh === ramielMainMesh);
        if (ramielIndex === -1) return;

        const ramielData = this.ramiels[ramielIndex];

        // 1. Ammo.js 物理ボディを削除
        if (ramielData.body) {
            this.physicsManager.removeRigidBody(ramielData.body);
        }

        // 2. Three.js メッシュ (本体とコア) をシーンから削除
        // コアは本体の子なので、本体を削除すればコアも一緒に削除される
        if (ramielData.mainMesh.parent) {
            ramielData.mainMesh.parent.remove(ramielData.mainMesh);
        }

        // 3. GeometryとMaterialを解放
        if (ramielData.mainMesh.geometry) ramielData.mainMesh.geometry.dispose();
        if (ramielData.mainMesh.material) {
            if (Array.isArray(ramielData.mainMesh.material)) {
                ramielData.mainMesh.material.forEach(mat => mat.dispose());
            } else {
                ramielData.mainMesh.material.dispose();
            }
        }
        if (ramielData.coreMesh.geometry) ramielData.coreMesh.geometry.dispose();
        if (ramielData.coreMesh.material) { // material は単体のはず
            ramielData.coreMesh.material.dispose();
        }


        // 4. 管理配列から除去
        this.ramiels.splice(ramielIndex, 1);

        // 5. raycastTargets配列からも除去
        const indexInRaycastTargets = this.raycastTargetsRef.indexOf(ramielData.mainMesh);
        if (indexInRaycastTargets !== -1) {
            this.raycastTargetsRef.splice(indexInRaycastTargets, 1);
        }
        // console.log(`${ramielData.mainMesh.name} 破壊完了 (RamielManager).`);
    }

    syncAllRamiels(tempTransform) {
        if (!tempTransform) return;
        for (const ramielData of this.ramiels) {
            if (ramielData.body) {
                const motionState = ramielData.body.getMotionState();
                if (motionState) {
                    motionState.getWorldTransform(tempTransform);
                    const p = tempTransform.getOrigin();
                    ramielData.mainMesh.position.set(p.x(), p.y(), p.z());
                    const q = tempTransform.getRotation();
                    ramielData.mainMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                    // コアはmainMeshの子なので、mainMeshのトランスフォームに追従する
                }
            }
        }
    }
}