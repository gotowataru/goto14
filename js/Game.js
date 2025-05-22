// Game.js (エントリーポイント、この上にindex.htmlとmain.jsがいる)
import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // CameraManager内でimport

import { PhysicsManager } from './PhysicsManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Character } from './Character.js';
import { InputManager } from './InputManager.js';
import { CameraManager } from './CameraManager.js';
import { ProjectileManager } from './ProjectileManager.js';
import { SphereManager } from './SphereManager.js';
import { RamielManager } from './RamielManager.js';
import { Minimap } from './Minimap.js';
import { EffectManager } from './EffectManager.js';
import { EnemyManager } from './EnemyManager.js'; // ★ EnemyManagerをインポート
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // ★ SkeletonUtilsをインポート

import { // 定数をインポート
    GRAVITY, MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS,
    CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE, CHARACTER_LOCAL_FORWARD,
    CHARACTER_SPEED, CHARACTER_ROTATION_SPEED, CHARACTER_HEIGHT,
    KICK_BEAM_DELAY, BEAM_SPAWN_OFFSET_FORWARD,
    NUM_SPHERES, MAZE_SCALE, MINIMAP_ENABLED,
    MINIMAP_INDICATOR_Y_OFFSET,
    NUM_RAMIELS, RAMIEL_COLOR,RAMIEL_SIZE,
    BEAM_DAMAGE,
    // オーディオ関連の定数
    BGM_PATH, BGM_VOLUME, BGM_LOOP,
    SFX_BEAM_PATH, SFX_BEAM_VOLUME, SFX_BEAM_LOOP,
    // 太陽の定数
    SUN_ENABLED, SUN_POSITION, SUN_SIZE, SUN_COLOR,SUN_EMISSIVE_INTENSITY,
    DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY,
    DIRECTIONAL_LIGHT_CAST_SHADOW,
    DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH, DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT,
    DIRECTIONAL_LIGHT_SHADOW_BIAS,
    SHADOW_CAMERA_NEAR, SHADOW_CAMERA_FAR, SHADOW_CAMERA_SIZE,
    RAMIEL_AT_FIELD_RADIUS,
    RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL,
    RAMIEL_AT_FIELD_ENABLED,

    // ★ Enemy_001関連の定数をインポート
    ENEMY_001_MODEL_PATH, ENEMY_001_ANIMATIONS, ENEMY_001_SCALE,
    // ENEMY_001_NUM_INSTANCES, ENEMY_001_INITIAL_POSITIONS などはEnemyManagerが内部で参照するのでここでは不要な場合も
} from './constants.js';


class Game {
    constructor() {
        // --- Three.js 関連 ---
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this._setupRenderer();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000 * MAZE_SCALE);

        // --- ゲームの状態やワールドに関するもの ---
        this.world = { mazeModel: null, collidables: [], mazeFloor: null };
        this.raycastTargets = [];
        this.mazeFloorMaxY = 0;
        this.gameStarted = false;
        this.tempTransform = null;

        // --- DOM要素の取得 ---
        this.startGameMessageElement = document.getElementById('start-game-message');
        this.loadingMessageElement = document.getElementById('loading-message');
        this.bgmVolumeSlider = document.getElementById('bgm-volume-slider');
        this.bgmVolumeValueSpan = document.getElementById('bgm-volume-value');
        this.sfxVolumeSlider = document.getElementById('sfx-volume-slider');
        this.sfxVolumeValueSpan = document.getElementById('sfx-volume-value');


        // --- 各マネージャーのインスタンス化 ---
        this.inputManager = new InputManager(this.renderer.domElement);
        this.physicsManager = new PhysicsManager(GRAVITY);
        this.assetLoader = new AssetLoader(); // AssetLoaderはEnemyManagerより先にインスタンス化
        this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.world.collidables);
        this.effectManager = new EffectManager(this.scene);
        this.projectileManager = new ProjectileManager(this.scene, () => this.raycastTargets, this.effectManager);
        this.sphereManager = new SphereManager(this.scene, this.physicsManager, this.raycastTargets);
        this.ramielManager = new RamielManager(this.scene, this.physicsManager, this.raycastTargets);
        this.enemyManager = null; // ★ EnemyManagerプロパティ (initで初期化)

        this.character = null;
        this.minimap = MINIMAP_ENABLED ? new Minimap(this.scene, this.renderer) : null;

        // --- オーディオ関連のプロパティ ---
        this.audioListener = new THREE.AudioListener();
        this.audioLoader = new THREE.AudioLoader();
        this.bgmSound = null;
        this.bgmLoaded = false;
        this.bgmPlayInitiated = false;
        this.sfxBeamSound = null;
        this.sfxBeamLoaded = false;

        console.log("Game constructor finished.");
    }

    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        console.log("Renderer setup complete.");
    }

    async init() {
        try {
            console.log("Game init started.");
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");
            console.log("PhysicsManager Ammo initialized.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();
            console.log("PhysicsManager world initialized.");

            // ★ EnemyManagerのインスタンス化 (PhysicsManagerとAssetLoaderの後)
            this.enemyManager = new EnemyManager(
                this.scene,
                this.physicsManager,
                this.effectManager,
                this.assetLoader, // AssetLoaderインスタンスを渡す
                this.raycastTargets,
                () => this.character // プレイヤーへの参照を返す関数
            );
            console.log("EnemyManager instantiated.");

            // --- ボリュームスライダーの初期設定とイベントリスナー ---
            if (this.bgmVolumeSlider) {
                this.bgmVolumeSlider.value = BGM_VOLUME.toString();
                if (this.bgmVolumeValueSpan) this.bgmVolumeValueSpan.textContent = `${Math.round(BGM_VOLUME * 100)}%`;
                this.bgmVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.bgmSound) this.bgmSound.setVolume(newVolume);
                    if (this.bgmVolumeValueSpan) this.bgmVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                });
            }
            if (this.sfxVolumeSlider) {
                this.sfxVolumeSlider.value = SFX_BEAM_VOLUME.toString();
                if (this.sfxVolumeValueSpan) this.sfxVolumeValueSpan.textContent = `${Math.round(SFX_BEAM_VOLUME * 100)}%`;
                this.sfxVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.sfxBeamSound) this.sfxBeamSound.setVolume(newVolume);
                    if (this.sfxVolumeValueSpan) this.sfxVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                });
            }
            console.log("Volume sliders setup.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '3Dシーン環境を初期化中...';
            this._initThreeJSEnvironment();
            console.log("Three.js environment initialized.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'アセットを読み込み中...';
            await this._loadAssetsAndSetupGame(); // ここでEnemyManagerへのアセット登録と敵生成も行われる
            console.log("Assets loaded and game objects setup.");

            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.cameraManager.getMainCamera().add(this.audioListener);
                console.log("AudioListener added to the main camera.");

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(BGM_PATH, (buffer) => {
                    this.bgmSound = new THREE.Audio(this.audioListener);
                    this.bgmSound.setBuffer(buffer);
                    this.bgmSound.setLoop(BGM_LOOP);
                    const currentSliderVolume = this.bgmVolumeSlider ? parseFloat(this.bgmVolumeSlider.value) : BGM_VOLUME;
                    this.bgmSound.setVolume(currentSliderVolume);
                    this.bgmLoaded = true;
                    console.log('BGM loaded successfully.');
                }, (xhr) => {
                    if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                        const percentLoaded = Math.round(xhr.loaded / xhr.total * 100);
                        this.loadingMessageElement.textContent = `BGMを読み込み中... ${percentLoaded}%`;
                    }
                }, (error) => {
                    console.error('BGMの読み込みに失敗しました:', error);
                    if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) this.loadingMessageElement.textContent = 'BGMの読み込みに失敗。';
                });

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(SFX_BEAM_PATH, (buffer) => {
                    this.sfxBeamSound = new THREE.Audio(this.audioListener);
                    this.sfxBeamSound.setBuffer(buffer);
                    this.sfxBeamSound.setLoop(SFX_BEAM_LOOP);
                    const currentSfxSliderVolume = this.sfxVolumeSlider ? parseFloat(this.sfxVolumeSlider.value) : SFX_BEAM_VOLUME;
                    this.sfxBeamSound.setVolume(currentSfxSliderVolume);
                    this.sfxBeamLoaded = true;
                    console.log('SFX (beam) loaded successfully.');
                }, undefined, (error) => {
                    console.error('SFX (beam) の読み込みに失敗しました:', error);
                     if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('効果音')) this.loadingMessageElement.textContent = '効果音の読み込みに失敗。';
                });
            } else {
                console.error("Main camera not available, cannot add AudioListener or load audio.");
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'カメラの準備ができず、音声を読み込めません。';
            }

            if (this.loadingMessageElement) this.loadingMessageElement.style.display = 'none';
            if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'block';
            console.log("Start game message displayed.");

            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
            console.log("Keydown listener for game start added.");

            window.addEventListener('resize', this._onWindowResize.bind(this));
            this.animate();
            console.log("Game init finished. Animation loop started.");

        } catch (error) {
            console.error("ゲームの初期化中に致命的なエラーが発生 (Game.init):", error);
            if (this.loadingMessageElement) {
                this.loadingMessageElement.textContent = 'エラー: 初期化に失敗しました。コンソールを確認。';
                this.loadingMessageElement.style.display = 'block';
                if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'none';
            }
        }
    }

    _handleStartKey(event) {
        if (event.key === 'Enter') {
            if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'none';
            this.gameStarted = true;
            if (!this.bgmPlayInitiated) {
                this._tryPlayBGM();
                this.bgmPlayInitiated = true;
            }
            console.log("Game started by Enter key!");
        } else {
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
        }
    }

    _tryPlayBGM() {
        if (!this.bgmLoaded || !this.bgmSound || this.bgmSound.isPlaying) return;
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume().then(() => {
                console.log("AudioContext resumed by user interaction (BGM).");
                if(this.bgmSound) this.bgmSound.play();
                console.log("BGM playback started after AudioContext resume.");
            }).catch(e => console.error("Error resuming AudioContext for BGM:", e));
        } else {
            if(this.bgmSound) this.bgmSound.play();
            console.log("BGM playback started.");
        }
    }

    _initThreeJSEnvironment() {
        this.scene.background = new THREE.Color(0x6699cc);
        this.scene.fog = new THREE.Fog(0x6699cc, 800 * MAZE_SCALE, 2500 * MAZE_SCALE);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.8);
        hemiLight.position.set(0, 250 * MAZE_SCALE, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
        dirLight.position.copy(SUN_POSITION);
        dirLight.castShadow = DIRECTIONAL_LIGHT_CAST_SHADOW;
        dirLight.shadow.camera.top = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.left = -SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.right = SHADOW_CAMERA_SIZE / 2;
        dirLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
        dirLight.shadow.camera.far = SHADOW_CAMERA_FAR;
        dirLight.shadow.mapSize.width = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_WIDTH;
        dirLight.shadow.mapSize.height = DIRECTIONAL_LIGHT_SHADOW_MAP_SIZE_HEIGHT;
        dirLight.shadow.bias = DIRECTIONAL_LIGHT_SHADOW_BIAS;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
        if (SUN_ENABLED) {
            const sunGeometry = new THREE.SphereGeometry(SUN_SIZE, 32, 32);
            const sunMaterial = new THREE.MeshStandardMaterial({
                emissive: SUN_COLOR, emissiveIntensity: SUN_EMISSIVE_INTENSITY,
                color: SUN_COLOR, metalness: 0.0, roughness: 1.0, fog: false
            });
            const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
            sunMesh.position.copy(SUN_POSITION);
            sunMesh.castShadow = false; sunMesh.receiveShadow = false;
            this.scene.add(sunMesh);
        }
    }

    async _loadAssetsAndSetupGame() {
        console.log("Game: _loadAssetsAndSetupGame started.");
        // AssetLoaderに渡すパスオブジェクトを構築
        const pathsToLoad = {
            MAZE_MODEL_PATH,
            CHARACTER_BASE_MODEL_PATH,
            ANIMATION_PATHS,
            // --- Enemy_001 アセットのパスとスケールを追加 ---
            ENEMY_001_MODEL_PATH,     // constants.js からの値
            ENEMY_001_ANIMATIONS,   // constants.js からの値
            ENEMY_001_SCALE,        // constants.js からの値
            // 他の敵タイプも同様に追加
        };
        console.log("Game: Paths to load for AssetLoader:", pathsToLoad);

        const loadedAssets = await this.assetLoader.loadAll(pathsToLoad);
        console.log("Game: Assets loaded by AssetLoader:", loadedAssets);


        if (loadedAssets.mazeModel) {
            this.world.mazeModel = loadedAssets.mazeModel;
            this.scene.add(this.world.mazeModel);
            this.world.mazeModel.updateMatrixWorld(true);
            let floorObjectFound = false;
            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true; child.receiveShadow = true;
                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true;
                        this.world.collidables.push(child);
                        this.raycastTargets.push(child);
                        const isSlopeObject = child.name.includes('_Slope_');
                        this.physicsManager.createWallPhysicsBody(child, isSlopeObject);
                    } else if (child.name === 'MazeFloor') {
                        this.world.mazeFloor = child;
                        this.world.collidables.push(child);
                        this.physicsManager.createWallPhysicsBody(child, false);
                        floorObjectFound = true;
                        const boundingBox = new THREE.Box3().setFromObject(child);
                        this.mazeFloorMaxY = boundingBox.max.y;
                        console.log(`MazeFloor found. Max Y: ${this.mazeFloorMaxY.toFixed(2)}, Min Y: ${boundingBox.min.y.toFixed(2)}`);
                    }
                }
            });
            if (!floorObjectFound) console.warn("警告: 'MazeFloor' という名前の床オブジェクトが見つかりませんでした。");
        } else {
            throw new Error("迷路モデルの読み込みに失敗しました。");
        }

        if (loadedAssets.characterBaseModel && loadedAssets.animations) {
            this.character = new Character(
                loadedAssets.characterBaseModel,
                loadedAssets.animations,
                this.scene, this.physicsManager,
                CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD, this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);
            // if (this.character.model) this.scene.add(this.character.model); // Character内でadd済みのはず
            console.log("Player character created.");
        } else {
            throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。");
        }

        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);
        console.log("Spheres created.");
        this.ramielManager.createRamiels(NUM_RAMIELS, this.world.mazeModel);
        console.log("Ramiels created.");

        // --- ★ 敵キャラクターのセットアップ ★ ---
        if (this.enemyManager) {
            // EnemyManagerにロード済みアセットを渡して初期化
            await this.enemyManager.initEnemyAssets(loadedAssets);
            // 指定タイプの敵を生成
            this.enemyManager.createEnemiesOfType('enemy_001');
            // 他の種類の敵も必要ならここで生成: this.enemyManager.createEnemiesOfType('enemy_002');
            console.log("Enemies setup via EnemyManager complete.");
        } else {
            console.warn("Game: EnemyManager not available. Skipping enemy creation.");
        }
        // --- ★ 敵キャラクターのセットアップここまで ★ ---

        this.cameraManager.setInitialCameraState(this.character.model);

        if (this.minimap) {
            if (this.world.mazeFloor) {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, this.world.mazeFloor);
            } else {
                console.warn("Minimap: 床オブジェクトが見つからないため、ミニマップカメラのセットアップをスキップしました。");
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null);
            }
            console.log("Minimap setup.");
        }
        console.log("Game: _loadAssetsAndSetupGame finished.");
    }

    _onCharacterAnimationFinished(finishedActionName) {
        if (finishedActionName === 'kick') {
            if (this.character) this.character.canPlayAction = true;
        }
        if (this.character && this.character.canPlayAction) {
            if (!this.character.isMoving && this.character.currentActionName !== 'idle') {
                this.character.switchAnimation('idle');
            } else if (this.character.isMoving && this.character.currentActionName !== 'run') {
                this.character.switchAnimation('run');
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const fixedTimeStep = 1.0 / 60.0;

        if (!this.gameStarted) {
            this.renderer.clear();
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            if (MINIMAP_ENABLED && this.minimap && this.character && this.character.model) { // character.modelの存在確認
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return;
        }

        if (this.inputManager.consumeSpacePress()) {
            if (this.character && this.character.startKickAction()) { /* Action successful */ }
        }

        if (this.character) {
            this.character.update(delta, this.inputManager, this.cameraManager.getMainCamera(), CHARACTER_SPEED, CHARACTER_ROTATION_SPEED);
        }

        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep);

        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }
        this.sphereManager.syncAllSpheres(this.tempTransform);
        this.ramielManager.syncAllRamiels(this.tempTransform);

        // --- ★ 敵の更新と物理同期を追加 ★ ---
        if (this.enemyManager) {
            this.enemyManager.update(delta); // AI、アニメーション更新、物理同期はEnemyManager.update内で行う
        }
        // --- ★ 敵の更新ここまで ★ ---

        if (this.character && this.character.currentActionName === 'kick' &&
            this.character.kickActionStartTime !== null && !this.character.beamGeneratedDuringKick) {
            const elapsedSinceKickStart = (performance.now() - this.character.kickActionStartTime) / 1000;
            if (elapsedSinceKickStart >= KICK_BEAM_DELAY) {
                const worldForward = this.character.localForwardDirection.clone().applyQuaternion(this.character.model.quaternion);
                this.projectileManager.createBeam(this.character.model, worldForward, CHARACTER_HEIGHT, BEAM_SPAWN_OFFSET_FORWARD);
                this.character.beamGeneratedDuringKick = true;
                if (this.sfxBeamLoaded && this.sfxBeamSound) {
                    if (this.sfxBeamSound.isPlaying) this.sfxBeamSound.stop();
                    this.sfxBeamSound.play();
                }
            }
        }

        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(this.character.model, this.character.isMoving, this.inputManager);
        }

        this.effectManager.update(delta);

        this.projectileManager.update(delta, (hitObject, projectile, hitPoint, distanceToHit, intersection) => {
            if (hitObject.userData && hitObject.userData.isWall) {
                return "stop_and_adjust";
            }
            if (this.sphereManager.isSphere(hitObject)) {
                if (projectile.userData.hitSpheresThisFrame && !projectile.userData.hitSpheresThisFrame.has(hitObject.uuid)) {
                    if (this.effectManager && hitObject.material && typeof hitObject.material.color !== 'undefined') {
                        const sphereColor = hitObject.material.color.clone();
                        this.effectManager.createSparkExplosion(hitObject.position.clone(), sphereColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(hitObject.position.clone(), sphereColor);
                    }
                    this.sphereManager.destroySphereByMesh(hitObject);
                    projectile.userData.hitSpheresThisFrame.add(hitObject.uuid);
                    return "destroy_target_and_continue";
                } else { return "ignore"; }
            }
            if (this.ramielManager.isRamiel(hitObject)) {
                const wasDestroyed = this.ramielManager.applyDamage(hitObject, BEAM_DAMAGE);
                if (this.effectManager && RAMIEL_AT_FIELD_ENABLED) {
                    const ramielPosition = hitObject.position.clone();
                    const characterPosition = this.character.model.position.clone();
                    const atFieldY = ramielPosition.y;
                    let directionToCharacter = characterPosition.clone().sub(ramielPosition);
                    directionToCharacter.y = 0; directionToCharacter.normalize();
                    const atFieldPosition = ramielPosition.clone().addScaledVector(directionToCharacter, RAMIEL_AT_FIELD_OFFSET_FROM_RAMIEL);
                    atFieldPosition.y = atFieldY;
                    this.effectManager.createRamielATFieldEffect(atFieldPosition, directionToCharacter.clone(), true);
                }
                if (wasDestroyed) {
                    if (this.effectManager) {
                        const rPos = hitObject.position.clone();
                        const rHalfH = RAMIEL_SIZE * 0.707;
                        const gPos = new THREE.Vector3(rPos.x, this.world.mazeFloor ? this.world.mazeFloorMaxY : rPos.y - rHalfH, rPos.z);
                        const rColor = new THREE.Color(RAMIEL_COLOR);
                        this.effectManager.createSparkExplosion(rPos, rColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(rPos, rColor);
                        this.effectManager.createRamielCrossExplosion(gPos);
                    }
                }
                return "stop_and_adjust"; // 常に停止
            }

            // --- ★ 敵へのヒット処理を追加 ★ ---
            if (this.enemyManager && this.enemyManager.isEnemy(hitObject)) {
                const enemy = this.enemyManager.getEnemyByMesh(hitObject);
                if (enemy && enemy.isAlive) {
                    // 将来的に: projectile.userData.hitEnemiesThisFrame のような Set で複数ヒット防止
                    // if (projectile.userData.hitEnemiesThisFrame && !projectile.userData.hitEnemiesThisFrame.has(enemy.model.uuid)) {

                    const wasDestroyed = enemy.applyDamage(BEAM_DAMAGE); // ダメージ適用

                    if (this.effectManager && hitObject.material) { // 色がなくても汎用エフェクト
                        this.effectManager.createSparkExplosion(hitPoint.clone(), new THREE.Color(0xffaa00)); // オレンジ色の火花
                    }

                    // projectile.userData.hitEnemiesThisFrame.add(enemy.model.uuid);

                    if (wasDestroyed) {
                        // 敵破壊時の追加エフェクト、スコア加算など (Enemy.die()で基本的なものは処理)
                        console.log("Game: Enemy destroyed by projectile:", enemy.config.KEY);
                    }
                    return "destroy_target_and_continue"; // ビームは貫通する場合
                    // return "stop_and_adjust"; // ビームが敵に当たって止まる場合
                    // } else { return "ignore"; }
                } else {
                    return "ignore"; // 既に死んでいるか、取得できなかった
                }
            }
            // --- ★ 敵へのヒット処理ここまで ★ ---

            return "ignore";
        });

        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera());
        }
        if (MINIMAP_ENABLED && this.minimap && this.character && this.character.model) { // character.modelの存在確認
            this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
        }
    }

    _onWindowResize() {
        if (!this.cameraManager || !this.renderer) return;
        const mainCamera = this.cameraManager.getMainCamera();
        if (!mainCamera) return;
        mainCamera.aspect = window.innerWidth / window.innerHeight;
        mainCamera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.minimap) this.minimap.onWindowResize();
    }

    // ★ ゲーム終了時のリソース解放メソッド (必要に応じて)
    // destroy() {
    //     console.log("Game: Destroying resources...");
    //     // アニメーションループを停止
    //     // イベントリスナーを削除
    //     // DOM要素を削除 (Rendererなど)
    //
    //     if (this.physicsManager) this.physicsManager.destroy();
    //     if (this.enemyManager) this.enemyManager.destroyAllEnemies();
    //     // 他のマネージャーの破棄処理も
    //     // this.sphereManager.destroyAllSpheres(); // (もしあれば)
    //     // this.ramielManager.destroyAllRamiels(); // (もしあれば)
    //     // this.projectileManager.destroyAllProjectiles(); // (もしあれば)
    //
    //     // Three.jsオブジェクトの解放
    //     // this.scene.traverse(object => { ... dispose ... });
    //     // this.renderer.dispose();
    //     console.log("Game: Resources destroyed.");
    // }
}

export { Game };

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init().catch(error => { // initがPromiseを返すので、ここでもエラーをキャッチできる
        console.error("Failed to initialize game from DOMContentLoaded:", error);
        const loadingMessageElement = document.getElementById('loading-message');
        if (loadingMessageElement) {
            loadingMessageElement.textContent = 'ゲームの起動に失敗しました。コンソールを確認してください。';
            loadingMessageElement.style.display = 'block';
        }
        const startGameMessageElement = document.getElementById('start-game-message');
        if (startGameMessageElement) {
            startGameMessageElement.style.display = 'none';
        }
    });
});