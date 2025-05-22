// RamielManager.js
import * as THREE from 'three';
import {
    RAMIEL_SIZE, RAMIEL_CORE_RADIUS_FACTOR, RAMIEL_COLOR, RAMIEL_CORE_COLOR,
    RAMIEL_OPACITY, RAMIEL_METALNESS, RAMIEL_ROUGHNESS,
    RAMIEL_MASS, RAMIEL_FRICTION, RAMIEL_RESTITUTION, RAMIEL_INITIAL_Y_OFFSET,
    RAMIEL_INITIAL_HP, MAZE_SCALE, // MAZE_SCALE をインポート (HPバーサイズ用)
    // --- HP Bar Constants ---
    RAMIEL_HP_BAR_ENABLED, RAMIEL_HP_BAR_WIDTH, RAMIEL_HP_BAR_HEIGHT,
    RAMIEL_HP_BAR_OFFSET_X, RAMIEL_HP_BAR_OFFSET_Y, RAMIEL_HP_BAR_OFFSET_Z,
    RAMIEL_HP_BAR_CANVAS_WIDTH, RAMIEL_HP_BAR_CANVAS_HEIGHT,
    RAMIEL_HP_BAR_BG_COLOR, RAMIEL_HP_BAR_FG_COLOR_HIGH, RAMIEL_HP_BAR_FG_COLOR_MID, RAMIEL_HP_BAR_FG_COLOR_LOW,
    RAMIEL_HP_BAR_BORDER_COLOR, RAMIEL_HP_BAR_BORDER_WIDTH,
    RAMIEL_HP_BAR_TEXT_LABEL, RAMIEL_HP_BAR_TEXT_COLOR, RAMIEL_HP_BAR_FONT_SIZE, RAMIEL_HP_BAR_FONT_FAMILY,
    RAMIEL_HP_BAR_TEXT_AREA_HEIGHT, RAMIEL_HP_BAR_PADDING_TOP_TEXT, RAMIEL_HP_BAR_PADDING_BOTTOM_TEXT,
    RAMIEL_HP_BAR_ACTUAL_BAR_HEIGHT, RAMIEL_HP_BAR_PADDING_HORIZONTAL
} from './constants.js';

export class RamielManager {
    constructor(scene, physicsManager, raycastTargetsArrayRef) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.raycastTargetsRef = raycastTargetsArrayRef;
        this.ramiels = [];

        // HPバー描画用のCanvasとContext (各インスタンスが固有に持つように変更)
        // this.hpBarCanvas = document.createElement('canvas');
        // this.hpBarContext = this.hpBarCanvas.getContext('2d');
    }

    // --- HPバー描画ヘルパーメソッド ---
    _drawHPBarOnCanvas(context, canvas, currentHP, maxHP) {
        context.clearRect(0, 0, canvas.width, canvas.height);

        // 1. テキスト描画
        context.fillStyle = RAMIEL_HP_BAR_TEXT_COLOR;
        context.font = `${RAMIEL_HP_BAR_FONT_SIZE}px ${RAMIEL_HP_BAR_FONT_FAMILY}`;
        // context.textAlign = 'center'; //textAlignはここで設定せず、描画前に設定

        const textToDraw = RAMIEL_HP_BAR_TEXT_LABEL; // 定数からラベルを取得
        const textMetrics = context.measureText(textToDraw);
        const actualTextWidth = textMetrics.width;

        const textX = (canvas.width - actualTextWidth) / 2; // Canvasの中央に来るようにX座標を計算
        const textY = RAMIEL_HP_BAR_PADDING_TOP_TEXT;

        context.textAlign = 'left'; // X座標を指定するので、左揃えで描画
        context.textBaseline = 'top';
        context.fillText(textToDraw, textX, textY);


        // 2. HPバーの描画領域 (変更なし)
        const barOuterX = RAMIEL_HP_BAR_PADDING_HORIZONTAL;
        const barOuterY = textY + RAMIEL_HP_BAR_TEXT_AREA_HEIGHT + RAMIEL_HP_BAR_PADDING_BOTTOM_TEXT; // textYの基準が変わったので影響なし
        const barOuterWidth = canvas.width - 2 * RAMIEL_HP_BAR_PADDING_HORIZONTAL;
        const barOuterHeight = RAMIEL_HP_BAR_ACTUAL_BAR_HEIGHT;

        // 3. HPバー背景 (空HP部分)
        context.fillStyle = RAMIEL_HP_BAR_BG_COLOR;
        context.fillRect(barOuterX, barOuterY, barOuterWidth, barOuterHeight);

        // 4. HPバー前景 (現在のHP)
        const hpRatio = Math.max(0, currentHP / maxHP);
        let fgColor = RAMIEL_HP_BAR_FG_COLOR_LOW;
        if (hpRatio > 0.66) {
            fgColor = RAMIEL_HP_BAR_FG_COLOR_HIGH;
        } else if (hpRatio > 0.33) {
            fgColor = RAMIEL_HP_BAR_FG_COLOR_MID;
        }
        context.fillStyle = fgColor;
        context.fillRect(
            barOuterX + RAMIEL_HP_BAR_BORDER_WIDTH, // 枠線内側に描画
            barOuterY + RAMIEL_HP_BAR_BORDER_WIDTH,
            (barOuterWidth - 2 * RAMIEL_HP_BAR_BORDER_WIDTH) * hpRatio,
            barOuterHeight - 2 * RAMIEL_HP_BAR_BORDER_WIDTH
        );

        // 5. HPバー枠線
        if (RAMIEL_HP_BAR_BORDER_WIDTH > 0) {
            context.strokeStyle = RAMIEL_HP_BAR_BORDER_COLOR;
            context.lineWidth = RAMIEL_HP_BAR_BORDER_WIDTH;
            context.strokeRect(
                barOuterX + RAMIEL_HP_BAR_BORDER_WIDTH / 2, // strokeRectは中心線基準なので調整
                barOuterY + RAMIEL_HP_BAR_BORDER_WIDTH / 2,
                barOuterWidth - RAMIEL_HP_BAR_BORDER_WIDTH,
                barOuterHeight - RAMIEL_HP_BAR_BORDER_WIDTH
            );
        }
    }

    _createHPBarSprite(currentHP, maxHP) {
        const canvas = document.createElement('canvas');
        canvas.width = RAMIEL_HP_BAR_CANVAS_WIDTH;
        canvas.height = RAMIEL_HP_BAR_CANVAS_HEIGHT;
        const context = canvas.getContext('2d');

        this._drawHPBarOnCanvas(context, canvas, currentHP, maxHP);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: true, // 通常はtrueでよい。他のオブジェクトとの前後関係を正しくするため。
            depthWrite: true, // 同上。半透明オブジェクトとの兼ね合いでfalseにする場合もある。
            // sizeAttenuation: false, // 画面からの距離でサイズが変わらないようにする場合 (今回はtrueでよい)
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(RAMIEL_HP_BAR_WIDTH, RAMIEL_HP_BAR_HEIGHT, 1.0);
        
        // SpriteにCanvasとContextを保持させておく
        sprite.userData.hpBarCanvas = canvas;
        sprite.userData.hpBarContext = context;
        sprite.userData.hpBarTexture = texture;

        return sprite;
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
            const size = RAMIEL_SIZE;
            const coreRadius = size * RAMIEL_CORE_RADIUS_FACTOR;

            const ramielGeometry = new THREE.OctahedronGeometry(size, 0);
            const ramielMaterial = new THREE.MeshStandardMaterial({
                color: RAMIEL_COLOR,
                metalness: RAMIEL_METALNESS,
                roughness: RAMIEL_ROUGHNESS,
                transparent: true,
                opacity: RAMIEL_OPACITY,
            });
            const ramielMesh = new THREE.Mesh(ramielGeometry, ramielMaterial);
            ramielMesh.castShadow = true;
            ramielMesh.receiveShadow = true;

            const coreGeometry = new THREE.SphereGeometry(coreRadius, 16, 16);
            const coreMaterial = new THREE.MeshBasicMaterial({
                color: RAMIEL_CORE_COLOR,
                toneMapped: false,
            });
            const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
            ramielMesh.add(coreMesh);

            const x = THREE.MathUtils.randFloat(mazeCenter.x - mazeSize.x / 2 * 0.7, mazeCenter.x + mazeSize.x / 2 * 0.7);
            const z = THREE.MathUtils.randFloat(mazeCenter.z - mazeSize.z / 2 * 0.7, mazeCenter.z + mazeSize.z / 2 * 0.7);
            const y = mazeBoundingBox.max.y + RAMIEL_INITIAL_Y_OFFSET + size;
            ramielMesh.position.set(x, y, z);
            ramielMesh.name = `Ramiel_${i}`; // デバッグ用に名前を保持

            this.scene.add(ramielMesh);

            const boxHalfExtents = new THREE.Vector3(size, size, size).multiplyScalar(0.707);
            const physicsBody = this.physicsManager.createBoxPhysicsBody(
                ramielMesh, boxHalfExtents, RAMIEL_MASS,
                RAMIEL_FRICTION, RAMIEL_RESTITUTION, false
            );

            let hpBarSprite = null;
            if (RAMIEL_HP_BAR_ENABLED) {
                hpBarSprite = this._createHPBarSprite(RAMIEL_INITIAL_HP, RAMIEL_INITIAL_HP);
                // HPバーの位置をラミエルのローカル座標で設定
                hpBarSprite.position.set(RAMIEL_HP_BAR_OFFSET_X, RAMIEL_HP_BAR_OFFSET_Y, RAMIEL_HP_BAR_OFFSET_Z);
                ramielMesh.add(hpBarSprite); // ラミエル本体の子オブジェクトとしてHPバーを追加
            }


            if (physicsBody) {
                const btTransform = new Ammo.btTransform();
                physicsBody.getWorldTransform(btTransform);
                physicsBody.setAngularFactor(new Ammo.btVector3(0.1, 0.1, 0.1));

                this.ramiels.push({
                    mainMesh: ramielMesh,
                    coreMesh: coreMesh,
                    body: physicsBody,
                    hp: RAMIEL_INITIAL_HP,
                    hpBarSprite: hpBarSprite // HPバーのスプライトを保存
                });
                this.raycastTargetsRef.push(ramielMesh);
            } else {
                this.scene.remove(ramielMesh); // HPバーも一緒に削除される (ramielMeshの子なので)
                ramielGeometry.dispose();
                ramielMaterial.dispose();
                coreGeometry.dispose();
                coreMaterial.dispose();
                if (hpBarSprite) { //念のため
                    hpBarSprite.userData.hpBarTexture.dispose();
                    hpBarSprite.material.dispose();
                }
            }
        }
    }

    isRamiel(object) {
        return this.ramiels.some(r => r.mainMesh === object);
    }

    applyDamage(ramielMainMesh, damageAmount) {
        const ramielData = this.ramiels.find(r => r.mainMesh === ramielMainMesh);
        if (!ramielData) {
            return false;
        }

        ramielData.hp -= damageAmount;

        // HPバーの表示を更新
        if (RAMIEL_HP_BAR_ENABLED && ramielData.hpBarSprite) {
            const sprite = ramielData.hpBarSprite;
            this._drawHPBarOnCanvas(
                sprite.userData.hpBarContext,
                sprite.userData.hpBarCanvas,
                ramielData.hp,
                RAMIEL_INITIAL_HP
            );
            sprite.userData.hpBarTexture.needsUpdate = true;
        }


        if (ramielData.hp <= 0) {
            this.destroyRamielByMesh(ramielMainMesh);
            return true;
        }
        return false;
    }

    destroyRamielByMesh(ramielMainMesh) {
        const ramielIndex = this.ramiels.findIndex(r => r.mainMesh === ramielMainMesh);
        if (ramielIndex === -1) return;

        const ramielData = this.ramiels[ramielIndex];

        if (ramielData.body) {
            this.physicsManager.removeRigidBody(ramielData.body);
        }

        // HPバーのクリーンアップ (ramielMeshの子なので、ramielMeshを削除すれば一緒に消えるが、テクスチャ等は明示的に解放)
        if (RAMIEL_HP_BAR_ENABLED && ramielData.hpBarSprite) {
            const sprite = ramielData.hpBarSprite;
            // ramielMesh.remove(sprite); // 親から削除されるので不要
            if (sprite.userData.hpBarTexture) sprite.userData.hpBarTexture.dispose();
            if (sprite.material) sprite.material.dispose();
            // Spriteのgeometryは内部的なものなので通常解放不要
        }

        if (ramielData.mainMesh.parent) {
            ramielData.mainMesh.parent.remove(ramielData.mainMesh);
        }

        if (ramielData.mainMesh.geometry) ramielData.mainMesh.geometry.dispose();
        if (ramielData.mainMesh.material) {
            if (Array.isArray(ramielData.mainMesh.material)) {
                ramielData.mainMesh.material.forEach(mat => mat.dispose());
            } else {
                ramielData.mainMesh.material.dispose();
            }
        }
        if (ramielData.coreMesh.geometry) ramielData.coreMesh.geometry.dispose();
        if (ramielData.coreMesh.material) {
            ramielData.coreMesh.material.dispose();
        }

        this.ramiels.splice(ramielIndex, 1);

        const indexInRaycastTargets = this.raycastTargetsRef.indexOf(ramielData.mainMesh);
        if (indexInRaycastTargets !== -1) {
            this.raycastTargetsRef.splice(indexInRaycastTargets, 1);
        }
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

                    // HPバーはラミエル本体の子オブジェクトなので、自動的に追従します。
                    // Spriteなので、自動的にカメラの方を向きます。
                }
            }
        }
    }
}