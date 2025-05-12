// Minimap.js
import * as THREE from 'three';
import {
    MINIMAP_SIZE_PX, MINIMAP_MARGIN_PX, MINIMAP_CAMERA_Y_OFFSET_FACTOR,
    MINIMAP_INDICATOR_Y_OFFSET, MINIMAP_INDICATOR_SIZE, MAZE_SCALE
} from './constants.js';

export class Minimap {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = null;
        this.characterIndicator = null;
        this.mazeFloor = null; // 床オブジェクトの参照を保持するプロパティ
        this.isEnabled = true; // Game.js側のMINIMAP_ENABLEDで実質制御

        if (this.isEnabled) { // この条件分岐は実質常にtrue (Game.jsで制御済みのため)
            this._initMinimapCamera();
            this._initCharacterIndicator();
        }
    }

    _initMinimapCamera() {
        this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000 * MAZE_SCALE);
        this.camera.up.set(0, 0, -1); // カメラの上方向をZ-に (真上から見た視点)
        // this.scene.add(this.camera); // カメラをシーンに追加する必要は通常ない
        this.camera.layers.enableAll(); // ミニマップカメラは全レイヤーを描画
    }

    _initCharacterIndicator() {
        const indicatorGeo = new THREE.ConeGeometry(MINIMAP_INDICATOR_SIZE, MINIMAP_INDICATOR_SIZE * 1.5, 4);
        indicatorGeo.translate(0, MINIMAP_INDICATOR_SIZE * 0.75, 0);
        indicatorGeo.rotateX(Math.PI / 2);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, toneMapped: false });
        this.characterIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        this.scene.add(this.characterIndicator);
        this.characterIndicator.layers.set(1); // ミニマップ専用レイヤー
    }

    setupMinimapCameraView(mazeModel, mazeFloorRef) { // mazeFloorRef を引数に追加
        if (!this.isEnabled || !mazeModel || !this.camera) return;

        this.mazeFloor = mazeFloorRef; // Game.js から渡された床の参照を保存

        const mazeBox = new THREE.Box3().setFromObject(mazeModel);
        const mazeSize = mazeBox.getSize(new THREE.Vector3());
        const mazeCenter = mazeBox.getCenter(new THREE.Vector3());

        const maxMazeDim = Math.max(mazeSize.x, mazeSize.z) * 1.1;

        this.camera.left = -maxMazeDim / 2;
        this.camera.right = maxMazeDim / 2;
        this.camera.top = maxMazeDim / 2;
        this.camera.bottom = -maxMazeDim / 2;

        this.camera.position.set(
            mazeCenter.x,
            mazeCenter.y + maxMazeDim * MINIMAP_CAMERA_Y_OFFSET_FACTOR,
            mazeCenter.z
        );
        this.camera.lookAt(mazeCenter.x, mazeCenter.y, mazeCenter.z);
        this.camera.updateProjectionMatrix();
        // console.log("ミニマップカメラ設定完了 (Minimap).");
    }

    updateAndRender(characterModel, characterHeight, mazeFloorMaxY, mazeFloorFromGame) { // mazeFloorFromGame を引数に追加
        if (!this.isEnabled || !this.camera || !characterModel || !this.characterIndicator) return;

        // Gameから渡された床の参照を優先的に使用 (setup時と異なる場合も考慮)
        // もしmazeFloorFromGameが常に渡されるなら、this.mazeFloorは不要になる可能性もある
        const currentActiveMazeFloor = mazeFloorFromGame || this.mazeFloor;

        // --- キャラクターインジケーターの更新 ---
        const charPos = characterModel.position;
        this.characterIndicator.position.x = charPos.x;
        this.characterIndicator.position.z = charPos.z;

        if (mazeFloorMaxY !== undefined) {
             this.characterIndicator.position.y = mazeFloorMaxY + MINIMAP_INDICATOR_Y_OFFSET;
        } else {
            this.characterIndicator.position.y = charPos.y + characterHeight / 2 + MINIMAP_INDICATOR_Y_OFFSET;
        }

        const eulerY = new THREE.Euler().setFromQuaternion(characterModel.quaternion, 'YXZ');
        this.characterIndicator.rotation.set(0, eulerY.y, 0);
        this.characterIndicator.updateMatrixWorld(true);


        // --- ミニマップのレンダリング処理 ---
        const mapScreenX = MINIMAP_MARGIN_PX;
        const mapScreenY = MINIMAP_MARGIN_PX;

        const currentScissorTest = this.renderer.getScissorTest();
        const currentScissor = new THREE.Vector4();
        if (currentScissorTest) this.renderer.getScissor(currentScissor);
        const currentViewport = new THREE.Vector4();
        this.renderer.getViewport(currentViewport);

        // --- 床マテリアルの一時的な変更 ---
        let originalOpacity, originalTransparent;
        if (currentActiveMazeFloor && currentActiveMazeFloor.material) {
            originalOpacity = currentActiveMazeFloor.material.opacity;
            originalTransparent = currentActiveMazeFloor.material.transparent;

            currentActiveMazeFloor.material.opacity = 0.3; // ミニマップ用の透明度
            currentActiveMazeFloor.material.transparent = true;
            currentActiveMazeFloor.material.needsUpdate = true;
        }

        this.renderer.setScissorTest(true);
        this.renderer.setScissor(mapScreenX, mapScreenY, MINIMAP_SIZE_PX, MINIMAP_SIZE_PX);
        this.renderer.setViewport(mapScreenX, mapScreenY, MINIMAP_SIZE_PX, MINIMAP_SIZE_PX);

        this.renderer.clearDepth(); // 深度バッファのみクリア
        this.renderer.render(this.scene, this.camera); // ミニマップカメラでシーンを描画

        // --- 床マテリアルを元に戻す ---
        if (currentActiveMazeFloor && currentActiveMazeFloor.material) {
            currentActiveMazeFloor.material.opacity = originalOpacity;
            currentActiveMazeFloor.material.transparent = originalTransparent;
            currentActiveMazeFloor.material.needsUpdate = true;
        }

        // レンダラーの状態を元に戻す
        this.renderer.setScissorTest(currentScissorTest);
        if (currentScissorTest) this.renderer.setScissor(currentScissor);
        this.renderer.setViewport(currentViewport);
    }
}