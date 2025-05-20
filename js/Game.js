// Game.js (エントリーポイント)
import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // CameraManager内でimport

import { PhysicsManager } from './PhysicsManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Character } from './Character.js';
import { InputManager } from './InputManager.js';
import { CameraManager } from './CameraManager.js';
import { ProjectileManager } from './ProjectileManager.js';
import { SphereManager } from './SphereManager.js';
import { RamielManager } from './RamielManager.js'; // ラミエル追加
import { Minimap } from './Minimap.js';
import { EffectManager } from './EffectManager.js';

import { // 定数をインポート
    GRAVITY, MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS,
    CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE, CHARACTER_LOCAL_FORWARD,
    CHARACTER_SPEED, CHARACTER_ROTATION_SPEED, CHARACTER_HEIGHT,
    KICK_BEAM_DELAY, BEAM_SPAWN_OFFSET_FORWARD,
    NUM_SPHERES, MAZE_SCALE, MINIMAP_ENABLED,
    MINIMAP_INDICATOR_Y_OFFSET,
    NUM_RAMIELS, RAMIEL_COLOR,RAMIEL_SIZE,
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
        this.gameStarted = false; // ゲームが実際に開始されたかのフラグ
        this.tempTransform = null;

        // --- DOM要素の取得 ---
        this.startGameMessageElement = document.getElementById('start-game-message');
        this.loadingMessageElement = document.getElementById('loading-message');
        // BGM ボリュームコントロール
        this.bgmVolumeSlider = document.getElementById('bgm-volume-slider');
        this.bgmVolumeValueSpan = document.getElementById('bgm-volume-value');
        // SFX ボリュームコントロール
        this.sfxVolumeSlider = document.getElementById('sfx-volume-slider');
        this.sfxVolumeValueSpan = document.getElementById('sfx-volume-value');


        // --- 各マネージャーのインスタンス化 ---
        this.inputManager = new InputManager(this.renderer.domElement);
        this.physicsManager = new PhysicsManager(GRAVITY);
        this.assetLoader = new AssetLoader();
        this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.world.collidables);
        this.effectManager = new EffectManager(this.scene);
        this.projectileManager = new ProjectileManager(this.scene, () => this.raycastTargets, this.effectManager);
        this.sphereManager = new SphereManager(this.scene, this.physicsManager, this.raycastTargets);
        this.ramielManager = new RamielManager(this.scene, this.physicsManager, this.raycastTargets); // ラミエル追加

        this.character = null; // アセットロード後に初期化
        this.minimap = MINIMAP_ENABLED ? new Minimap(this.scene, this.renderer) : null;

        // --- オーディオ関連のプロパティ ---
        this.audioListener = new THREE.AudioListener();
        this.audioLoader = new THREE.AudioLoader();
        this.bgmSound = null;
        this.bgmLoaded = false;
        this.bgmPlayInitiated = false; // BGMが再生開始されたかのフラグ (初回のみ再生用)
        this.sfxBeamSound = null;
        this.sfxBeamLoaded = false;
    }

    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
    }

    async init() {
        try {
            // --- 1. 物理エンジン関連の初期化 ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();

            // --- ボリュームスライダーの初期設定とイベントリスナー ---
            // BGM用
            if (this.bgmVolumeSlider) {
                this.bgmVolumeSlider.value = BGM_VOLUME.toString();
                if (this.bgmVolumeValueSpan) {
                    this.bgmVolumeValueSpan.textContent = `${Math.round(BGM_VOLUME * 100)}%`;
                }
                this.bgmVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.bgmSound) {
                        this.bgmSound.setVolume(newVolume);
                    }
                    if (this.bgmVolumeValueSpan) {
                        this.bgmVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                    }
                });
            }
            // SFX用
            if (this.sfxVolumeSlider) {
                this.sfxVolumeSlider.value = SFX_BEAM_VOLUME.toString(); // SFXの初期ボリューム
                if (this.sfxVolumeValueSpan) {
                    this.sfxVolumeValueSpan.textContent = `${Math.round(SFX_BEAM_VOLUME * 100)}%`;
                }
                this.sfxVolumeSlider.addEventListener('input', (event) => {
                    const newVolume = parseFloat(event.target.value);
                    if (this.sfxBeamSound) { // sfxBeamSound オブジェクトのボリュームを変更
                        this.sfxBeamSound.setVolume(newVolume);
                    }
                    if (this.sfxVolumeValueSpan) {
                        this.sfxVolumeValueSpan.textContent = `${Math.round(newVolume * 100)}%`;
                    }
                    // 他のSFXがある場合は、それらもここで更新するか、
                    // SFX再生時にこのスライダーの値からボリュームを取得する仕組みが必要
                });
            }

            // --- 2. Three.js環境の初期化 ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '3Dシーン環境を初期化中...';
            this._initThreeJSEnvironment();

            // --- 3. アセットのロードとゲームオブジェクトのセットアップ ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'アセットを読み込み中...';
            await this._loadAssetsAndSetupGame();

            // --- 4. オーディオ関連の初期化 ---
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.cameraManager.getMainCamera().add(this.audioListener);
                console.log("AudioListener added to the main camera.");

                // BGMロード
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(
                    BGM_PATH,
                    (buffer) => {
                        this.bgmSound = new THREE.Audio(this.audioListener);
                        this.bgmSound.setBuffer(buffer);
                        this.bgmSound.setLoop(BGM_LOOP);
                        const currentSliderVolume = this.bgmVolumeSlider ? parseFloat(this.bgmVolumeSlider.value) : BGM_VOLUME;
                        this.bgmSound.setVolume(currentSliderVolume);
                        this.bgmLoaded = true;
                        console.log('BGM loaded successfully.');
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                            // 他のロードが終わっていればメッセージを変えるなど
                        }
                    },
                    (xhr) => {
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                            const percentLoaded = Math.round(xhr.loaded / xhr.total * 100);
                            this.loadingMessageElement.textContent = `BGMを読み込み中... ${percentLoaded}%`;
                        }
                    },
                    (error) => {
                        console.error('BGMの読み込みに失敗しました:', error);
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) this.loadingMessageElement.textContent = 'BGMの読み込みに失敗。';
                    }
                );

                // SFXロード (ビーム音)
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(
                    SFX_BEAM_PATH,
                    (buffer) => {
                        this.sfxBeamSound = new THREE.Audio(this.audioListener);
                        this.sfxBeamSound.setBuffer(buffer);
                        this.sfxBeamSound.setLoop(SFX_BEAM_LOOP);
                        const currentSfxSliderVolume = this.sfxVolumeSlider ? parseFloat(this.sfxVolumeSlider.value) : SFX_BEAM_VOLUME;
                        this.sfxBeamSound.setVolume(currentSfxSliderVolume);
                        this.sfxBeamLoaded = true;
                        console.log('SFX (beam) loaded successfully.');
                    },
                    undefined, // onProgress for SFX (optional)
                    (error) => {
                        console.error('SFX (beam) の読み込みに失敗しました:', error);
                         if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('効果音')) this.loadingMessageElement.textContent = '効果音の読み込みに失敗。';
                    }
                );
            } else {
                console.error("Main camera not available, cannot add AudioListener or load audio.");
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'カメラの準備ができず、音声を読み込めません。';
            }

            // ローディングメッセージを非表示にし、スタートメッセージを表示
            if (this.loadingMessageElement) {
                this.loadingMessageElement.style.display = 'none';
            }
            if (this.startGameMessageElement) {
                this.startGameMessageElement.style.display = 'block';
                console.log("Start game message displayed.");
            }

            // ゲーム開始用のキーイベントリスナーを設定
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
            console.log("Keydown listener for game start added.");

            window.addEventListener('resize', this._onWindowResize.bind(this));
            this.animate();
            console.log("Animation loop started.");

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
            if (this.startGameMessageElement) {
                this.startGameMessageElement.style.display = 'none';
            }
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
        // ボリュームはロード時とスライダー操作時に設定済み
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

        // --- 指向性光源 (太陽光) の設定を定数から行う ---
        const dirLight = new THREE.DirectionalLight(
            DIRECTIONAL_LIGHT_COLOR,
            DIRECTIONAL_LIGHT_INTENSITY
        );

        dirLight.position.copy(SUN_POSITION); // 太陽の位置を光源の方向として設定
        dirLight.castShadow = DIRECTIONAL_LIGHT_CAST_SHADOW;

        // シャドウカメラの設定を定数から行う
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
        this.scene.add(dirLight.target); // ターゲットはデフォルトで原点 (0,0,0)

        // --- 「見える太陽」オブジェクトの作成 ---
        if (SUN_ENABLED) {
            const sunGeometry = new THREE.SphereGeometry(SUN_SIZE, 32, 32);

            // ↓↓↓ ここのマテリアル設定を変更します ↓↓↓

            // --- MeshBasicMaterial を使用する場合 (自己発光ではない) ---
            // このブロックをコメントアウトします
            /*
            const sunMaterial = new THREE.MeshBasicMaterial({
                color: SUN_COLOR,
                // fog: false // 太陽が霧の影響を受けないようにする場合 (これはMeshStandardMaterial側にもあります)
            });
            */

            // --- MeshStandardMaterialで自己発光させる場合 (PostProcessingでBloomエフェクトをかけると効果的) ---
            // このブロックのコメントアウトを外します
            const sunMaterial = new THREE.MeshStandardMaterial({
                emissive: SUN_COLOR,                 // 発光色 (太陽の色と同じにする)
                emissiveIntensity: SUN_EMISSIVE_INTENSITY, // 発光の強さ (constants.js で定義)
                color: SUN_COLOR,                    // ベースカラーも太陽の色に設定 (ほぼ見えなくなるが念のため)
                metalness: 0.0,                      // 非金属
                roughness: 1.0,                      // 完全にマットな表面 (光をあまり反射しない)
                fog: false                           // 太陽が霧の影響を受けないようにする
            });
            // ↑↑↑ ここまでが自己発光用のマテリアル設定 ↑↑↑

            const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
            sunMesh.position.copy(SUN_POSITION); // 光源と同じ位置に太陽オブジェクトを配置
            sunMesh.castShadow = false;      // 太陽自体は影を落とさない
            sunMesh.receiveShadow = false;   // 太陽自体は他の影を受けない
            this.scene.add(sunMesh);
            // this.sunMesh = sunMesh; // 必要に応じて太陽メッシュをプロパティに保持
        }
    }

    async _loadAssetsAndSetupGame() {
        const { mazeModel, characterBaseModel, animations } = await this.assetLoader.loadAll({
            MAZE_MODEL_PATH,
            CHARACTER_BASE_MODEL_PATH,
            ANIMATION_PATHS
        });

        if (mazeModel) {
            this.world.mazeModel = mazeModel;
            this.scene.add(this.world.mazeModel);
            this.world.mazeModel.updateMatrixWorld(true);
            let floorObjectFound = false;

            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true;
                        this.world.collidables.push(child);
                        this.raycastTargets.push(child);
                        const isSlopeObject = child.name.includes('_Slope_');
                        this.physicsManager.createWallPhysicsBody(child, isSlopeObject);
                    }
                    else if (child.name === 'MazeFloor') {
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

            if (!floorObjectFound) {
                console.warn("警告: 'MazeFloor' という名前の床オブジェクトが見つかりませんでした。");
            }
        } else {
            throw new Error("迷路モデルの読み込みに失敗しました。");
        }

        if (characterBaseModel && animations) {
            this.character = new Character(
                characterBaseModel,
                animations,
                this.scene,
                this.physicsManager,
                CHARACTER_INITIAL_POSITION,
                CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD,
                this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);

            if (this.character.model) {
                this.scene.add(this.character.model);
                this.character.model.updateMatrixWorld(true);
                const characterBoundingBox = new THREE.Box3().setFromObject(this.character.model);
                const characterSize = new THREE.Vector3();
                characterBoundingBox.getSize(characterSize);
                console.log('--- Character Model Dimensions (after scaling in Character.js) ---');
                console.log('Character Min:', characterBoundingBox.min);
                console.log('Character Max:', characterBoundingBox.max);
                console.log('Character Width (X):', characterSize.x);
                console.log('Character Height (Y):', characterSize.y);
                console.log('Character Depth (Z):', characterSize.z);
                console.log('Defined CHARACTER_HEIGHT:', CHARACTER_HEIGHT);
                console.log('Calculated Model Height (Y):', characterSize.y);
            }
        } else {
            throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。");
        }

        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);
        this.ramielManager.createRamiels(NUM_RAMIELS, this.world.mazeModel);
        this.cameraManager.setInitialCameraState(this.character.model);

        if (this.minimap) {
            if (this.world.mazeFloor) {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, this.world.mazeFloor);
            } else {
                console.warn("Minimap: 床オブジェクトが見つからないため、ミニマップカメラのセットアップをスキップしました。");
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null);
            }
        }
    }

    _onCharacterAnimationFinished(finishedActionName) {
        console.log("Game._onCharacterAnimationFinished: CALLED with action:", finishedActionName);
        if (finishedActionName === 'kick') {
            if (this.character) {
                console.log("Game._onCharacterAnimationFinished: Kick finished. Setting character.canPlayAction = true.");
                this.character.canPlayAction = true;
            }
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
            // ゲーム開始前もシーンとミニマップのレンダリングは行う
            this.renderer.clear();
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            if (MINIMAP_ENABLED && this.minimap && this.character) {
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return;
        }

        // --- 通常のゲームループ ---
        if (this.inputManager.consumeSpacePress()) {
            if (this.character && this.character.startKickAction()) {
                // キックアクション成功時の処理 (効果音は Character.startKickAction or animate()内のビーム生成時)
            }
        }

        if (this.character) {
            this.character.update(
                delta, this.inputManager, this.cameraManager.getMainCamera(),
                CHARACTER_SPEED, CHARACTER_ROTATION_SPEED
            );
        }

        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep);

        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }

        this.sphereManager.syncAllSpheres(this.tempTransform);
        this.ramielManager.syncAllRamiels(this.tempTransform);


        if (this.character && this.character.currentActionName === 'kick' &&
            this.character.kickActionStartTime !== null && !this.character.beamGeneratedDuringKick) {
            const elapsedSinceKickStart = (performance.now() - this.character.kickActionStartTime) / 1000;
            if (elapsedSinceKickStart >= KICK_BEAM_DELAY) {
                const worldForward = this.character.localForwardDirection.clone().applyQuaternion(this.character.model.quaternion);
                this.projectileManager.createBeam(
                    this.character.model, worldForward, CHARACTER_HEIGHT, BEAM_SPAWN_OFFSET_FORWARD
                );
                this.character.beamGeneratedDuringKick = true;
                if (this.sfxBeamLoaded && this.sfxBeamSound) {
                    if (this.sfxBeamSound.isPlaying) this.sfxBeamSound.stop();
                    // ボリュームはTHREE.Audioオブジェクトに既に設定されているので、play()だけでOK
                    this.sfxBeamSound.play();
                }
            }
        }

        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(
                this.character.model, this.character.isMoving, this.inputManager
            );
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
                } else {
                    return "ignore";
                }
            }
            if (this.ramielManager.isRamiel(hitObject)) {
                if (this.effectManager) {
                    const ramielEffectPosition = hitObject.position.clone();
                    const ramielBodyHalfHeight = RAMIEL_SIZE * 0.707;
                    const groundPosition = new THREE.Vector3(
                        ramielEffectPosition.x,
                        this.world.mazeFloor ? this.world.mazeFloorMaxY : ramielEffectPosition.y - ramielBodyHalfHeight,
                        ramielEffectPosition.z
                    );
                    const ramielBaseColor = new THREE.Color(RAMIEL_COLOR);
                    this.effectManager.createSparkExplosion(
                        ramielEffectPosition,
                        ramielBaseColor.clone().multiplyScalar(1.5)
                    );
                    this.effectManager.createDebrisExplosion(
                        ramielEffectPosition,
                        ramielBaseColor
                    );
                    this.effectManager.createRamielCrossExplosion(groundPosition);
                }
                this.ramielManager.destroyRamielByMesh(hitObject);
                return "destroy_target_and_continue";
            }
            return "ignore";
        });

        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera());
        }

        if (MINIMAP_ENABLED && this.minimap && this.character) {
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
}

export { Game };

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});