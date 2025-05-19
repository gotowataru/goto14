// Game.js
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
    NUM_RAMIELS, RAMIEL_COLOR,RAMIEL_SIZE, // ラミエル追加
    AUDIO_BGM_PATH, AUDIO_BGM_VOLUME, AUDIO_BGM_LOOP,
    AUDIO_SFX_BEAM_PATH, AUDIO_SFX_BEAM_VOLUME, AUDIO_SFX_BEAM_LOOP,
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

        // --- DOM要素の取得 (音量調整UI用) ---
        this.bgmVolumeSlider = document.getElementById('bgm-volume');
        this.bgmVolumeValueElement = document.getElementById('bgm-volume-value');
        this.sfxVolumeSlider = document.getElementById('sfx-volume');
        this.sfxVolumeValueElement = document.getElementById('sfx-volume-value');

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
            // --- 音量コントロールのセットアップを呼び出し ---
            this._setupAudioControls(); 

            // --- 1. 物理エンジン関連の初期化 ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();

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

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(
                    AUDIO_BGM_PATH,
                    (buffer) => {
                        this.bgmSound = new THREE.Audio(this.audioListener);
                        this.bgmSound.setBuffer(buffer);
                        this.bgmSound.setLoop(AUDIO_BGM_LOOP);
                        this.bgmSound.setVolume(AUDIO_BGM_VOLUME);
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

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(
                    AUDIO_SFX_BEAM_PATH,
                    (buffer) => {
                        this.sfxBeamSound = new THREE.Audio(this.audioListener);
                        this.sfxBeamSound.setBuffer(buffer);
                        this.sfxBeamSound.setLoop(AUDIO_SFX_BEAM_LOOP);
                        this.sfxBeamSound.setVolume(AUDIO_SFX_BEAM_VOLUME);
                        this.sfxBeamLoaded = true;
                        console.log('SFX (beam) loaded successfully.');
                        // 両方のオーディオロードが終わったタイミングでロードメッセージを最終更新しても良い
                    },
                    undefined,
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


    // --- ▼▼▼ 音量調整UIのセットアップとイベントリスナー設定用メソッド ▼▼▼ ---
    _setupAudioControls() {
        if (!this.bgmVolumeSlider || !this.bgmVolumeValueElement || !this.sfxVolumeSlider || !this.sfxVolumeValueElement) {
            console.warn("音量調整UIの要素が見つかりません。");
            return;
        }

        // BGMボリュームスライダーの初期設定
        this.bgmVolumeSlider.value = AUDIO_BGM_VOLUME;
        this.bgmVolumeValueElement.textContent = `${Math.round(AUDIO_BGM_VOLUME * 100)}%`;
        this.bgmVolumeSlider.addEventListener('input', (event) => {
            const volume = parseFloat(event.target.value);
            if (this.bgmSound) {
                this.bgmSound.setVolume(volume);
            }
            this.bgmVolumeValueElement.textContent = `${Math.round(volume * 100)}%`;
        });

        // 効果音ボリュームスライダーの初期設定
        this.sfxVolumeSlider.value = AUDIO_SFX_BEAM_VOLUME;
        this.sfxVolumeValueElement.textContent = `${Math.round(AUDIO_SFX_BEAM_VOLUME * 100)}%`;
        this.sfxVolumeSlider.addEventListener('input', (event) => {
            const volume = parseFloat(event.target.value);
            // sfxBeamSound は再生時にボリュームが適用されることが多いが、
            // ここで設定しておけば、次回再生時からこのボリュームになる。
            // もし即時反映させたいなら、現在再生中の効果音インスタンスのボリュームも変更する必要があるが、
            // THREE.Audioでは個別の再生インスタンスのボリューム変更は難しい。
            // この場合、AUDIO_SFX_BEAM_VOLUME のような定数を更新し、
            // sfxBeamSound.play() の直前に setVolume するか、
            // sfxBeamSound 自体のデフォルトボリュームとして設定する。
            // 今回は sfxBeamSound のデフォルトボリュームを変更する方針で。
            if (this.sfxBeamSound) {
                this.sfxBeamSound.setVolume(volume);
            }
            this.sfxVolumeValueElement.textContent = `${Math.round(volume * 100)}%`;
        });

        console.log("音量調整UIがセットアップされました。");
    }
    // --- ▲▲▲ 音量調整UIのセットアップとイベントリスナー設定用メソッド ▲▲▲ ---








    _handleStartKey(event) {
        if (event.key === 'Enter') {
            if (this.startGameMessageElement) {
                this.startGameMessageElement.style.display = 'none';
            }
            this.gameStarted = true;

            if (!this.bgmPlayInitiated) { // bgmPlayInitiated を使って初回のみ再生
                this._tryPlayBGM(); // この中で AudioContext.resume も行われる
                this.bgmPlayInitiated = true;
            }
            console.log("Game started by Enter key!");
        } else {
            // Enter以外のキーが押された場合は、再度リスナーを設定し直す
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
        }
    }

    _tryPlayBGM() {
        if (!this.bgmLoaded || !this.bgmSound || this.bgmSound.isPlaying) return;
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume().then(() => {
                console.log("AudioContext resumed by user interaction (BGM).");
                if(this.bgmSound) this.bgmSound.play(); // 再度チェック
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
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
        dirLight.position.set(150 * MAZE_SCALE, 350 * MAZE_SCALE, 200 * MAZE_SCALE);
        dirLight.castShadow = true;
        const shadowCamSize = 2000 * MAZE_SCALE;
        dirLight.shadow.camera.top = shadowCamSize;
        dirLight.shadow.camera.bottom = -shadowCamSize;
        dirLight.shadow.camera.left = -shadowCamSize;
        dirLight.shadow.camera.right = shadowCamSize;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 1000 * MAZE_SCALE;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
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
            this.world.mazeModel.updateMatrixWorld(true); // 子要素のワールド行列を最新に
            let floorObjectFound = false;

            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true; // 壁であるというマーキング
                        this.world.collidables.push(child); // カメラ衝突用
                        this.raycastTargets.push(child);    // ビーム衝突用

                        // ★ 坂道かどうかを判定 (例:名前に "_Slope_" が含まれるか)
                        const isSlopeObject = child.name.includes('_Slope_');
                        this.physicsManager.createWallPhysicsBody(child, isSlopeObject); // 第2引数で坂道情報を渡す
                    }
                    else if (child.name === 'MazeFloor') { // 床の処理 (else if に変更推奨)
                        this.world.mazeFloor = child;
                        this.world.collidables.push(child);
                        // 床は通常平らなので isSlope は false
                        this.physicsManager.createWallPhysicsBody(child, false);
                        floorObjectFound = true;
                        const boundingBox = new THREE.Box3().setFromObject(child);
                        this.mazeFloorMaxY = boundingBox.max.y;
                        console.log(`MazeFloor found. Max Y: ${this.mazeFloorMaxY.toFixed(2)}, Min Y: ${boundingBox.min.y.toFixed(2)}`); // ★ ログ追加
                        // ★ (オプション) 床もビームの衝突対象にするなら
                        // this.raycastTargets.push(child);
                    }
                    // 他にも特定の名前やuserDataで識別するオブジェクトがあればここに追加
                }
            });

            if (!floorObjectFound) {
                console.warn("警告: 'MazeFloor' という名前の床オブジェクトが見つかりませんでした。");
                // 床がないとキャラクターの初期位置などが問題になる可能性
            }
        } else {
            throw new Error("迷路モデルの読み込みに失敗しました。");
        }

        if (characterBaseModel && animations) {
            this.character = new Character(
                characterBaseModel,
                animations, // ジャンプアニメーションも含まれている
                this.scene,
                this.physicsManager,
                CHARACTER_INITIAL_POSITION,
                CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD,
                this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);
        } else {
            throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。");
        }

        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);
        this.ramielManager.createRamiels(NUM_RAMIELS, this.world.mazeModel); // ラミエル追加
        this.cameraManager.setInitialCameraState(this.character.model); // character が null でないことを保証

        if (this.minimap) {
            if (this.world.mazeFloor) { // 床オブジェクトが存在する場合のみ設定
                this.minimap.setupMinimapCameraView(this.world.mazeModel, this.world.mazeFloor);
            } else {
                console.warn("Minimap: 床オブジェクトが見つからないため、ミニマップカメラのセットアップをスキップしました。");
                // フォールバックとして迷路モデル全体からカメラを設定するなどの処理も考えられる
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null); // 床なしで呼ぶか、別のロジック
            }
        }
    }

    _onCharacterAnimationFinished(finishedActionName) {
    console.log("Game._onCharacterAnimationFinished: CALLED with action:", finishedActionName); // ★ ログ追加
        if (finishedActionName === 'kick') {
            if (this.character) { // nullチェックを追加
            console.log("Game._onCharacterAnimationFinished: Kick finished. Setting character.canPlayAction = true."); // ★ ログ追加
            this.character.canPlayAction = true;
            }
        }
        if (this.character && this.character.canPlayAction) { // nullチェックと条件の簡略化
            // if (this.character.isGrounded) { // ← isGrounded は Character 側で常に true (仮)
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
        const fixedTimeStep = 1.0 / 60.0; // 物理演算の固定時間ステップ

        // ★★★ 修正箇所: gameStarted のチェックを animate の先頭に移動 ★★★
        if (!this.gameStarted) {
            if (this.character && this.cameraManager && this.cameraManager.getMainCamera()) {
            }
            this.renderer.clear();

            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            if (MINIMAP_ENABLED && this.minimap && this.character) { // MINIMAP_ENABLED も考慮
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return; // gameStartedがfalseの間は、以下の処理に進まない
        }

        // --- 通常のゲームループ (gameStarted が true の場合) ---

        // ★★★ 修正箇所: キック入力処理 (character の存在チェックを追加) ★★★
        if (this.inputManager.consumeSpacePress()) {
            if (this.character && this.character.startKickAction()) {
                // キックアクションが成功した場合の処理 (例:効果音の再生など)
                // (効果音再生は Character.startKickAction 内か、ここで行うか設計による)
            }
        }

        // キャラクターの更新 (character の存在チェックを追加)
        if (this.character) {
            this.character.update(
                delta, this.inputManager, this.cameraManager.getMainCamera(),
                CHARACTER_SPEED, CHARACTER_ROTATION_SPEED
            );
        }

        // 物理シミュレーションのステップ
        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep);

        // キャラクターの物理状態をモデルに同期 (character の存在チェックを追加)
        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }

        // 球の物理状態をモデルに同期
        this.sphereManager.syncAllSpheres(this.tempTransform);

        // --- 追加 ラミエルの同期処理 ---
        this.ramielManager.syncAllRamiels(this.tempTransform);


        // ビーム生成ロジック (character の存在チェックと kickActionStartTime のチェックを追加)
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
                    this.sfxBeamSound.play();
                }
            }
        }

        // カメラの更新 (character の存在チェックを追加)
        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(
                this.character.model, this.character.isMoving, this.inputManager
            );
        }

        // エフェクトの更新
        this.effectManager.update(delta);

        // プロジェクタイル（ビーム）の更新
        this.projectileManager.update(delta, (hitObject, projectile, hitPoint, distanceToHit, intersection) => {
            // ... (既存のビーム衝突処理) ...
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

            // --- ここから 追加ラミエルの衝突判定 ---
            if (this.ramielManager.isRamiel(hitObject)) {
                if (this.effectManager) {
                    const ramielEffectPosition = hitObject.position.clone();


                    // ★★★ hitObject の Y 座標を地面の高さに補正する ★★★
                    // PhysicsManager から地面の高さを取得するか、
                    // mazeFloorMaxY を使うなど、適切な地面の高さを設定する。
                    // ここでは仮に mazeFloorMaxY を使用する (ramielEffectPositionが空中に浮いている場合を想定)
                    // もし hitObject.position が既に地面に近いならこの補正は不要か、微調整。
                    // 理想は、衝突点のy座標を使うか、ラミエルの足元のy座標を使う。
                    // 今回はラミエルの中心位置のYから、ラミエルの高さの半分を引いて足元を出すイメージ。
                    const ramielBodyHalfHeight = RAMIEL_SIZE * 0.707; // 物理ボディのサイズから（要調整）
                    const groundPosition = new THREE.Vector3(
                        ramielEffectPosition.x,
                        // hitObject.position.y - ramielBodyHalfHeight, // ラミエルの足元想定
                        this.world.mazeFloor ? this.world.mazeFloorMaxY : ramielEffectPosition.y - ramielBodyHalfHeight, // 床があるなら床のY、なければ計算
                        ramielEffectPosition.z
                    );





                    const ramielBaseColor = new THREE.Color(RAMIEL_COLOR); // 定数から取得

                    // 火花エフェクト (色はラミエルカラー、その他は球体と同じ設定)
                    this.effectManager.createSparkExplosion(
                        ramielEffectPosition,
                        ramielBaseColor.clone().multiplyScalar(1.5) // 色を少し明るくするなどの調整は可能
                    );

                    // デブリエフェクト (色はラミエルカラー、その他は球体と同じ設定)
                    this.effectManager.createDebrisExplosion(
                        ramielEffectPosition, // createSparkExplosionでcloneしているので、再度cloneするか同じものを使う
                        ramielBaseColor
                    );

                    // --- ここから十字架エフェクトの呼び出し ---
                    this.effectManager.createRamielCrossExplosion(groundPosition); // 十字架は地面から

                }
                this.ramielManager.destroyRamielByMesh(hitObject);
                return "destroy_target_and_continue";
            }
            // --- 追加ラミエルとの衝突判定 ---




            return "ignore";
        });


        // レンダリング
        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera());
        }

        // ミニマップの更新とレンダリング (character の存在チェックを追加)
        if (MINIMAP_ENABLED && this.minimap && this.character) { // MINIMAP_ENABLED も考慮
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
