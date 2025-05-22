// AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {
    MAZE_SCALE, MAZE_Y_OFFSET,
    CHARACTER_INITIAL_SCALE,
} from './constants.js';

export class AssetLoader {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        console.log("AssetLoader initialized.");
    }

    async loadAll(paths) {
        console.log("AssetLoader.loadAll called with paths:", paths);
        const promises = [];
        const loadedAssets = {
            mazeModel: null,
            characterBaseModel: null,
            animations: {},
            enemies: {}
        };

        // 1. 迷路モデルの読み込み (変更なし)
        if (paths.MAZE_MODEL_PATH) {
            promises.push(
                this.gltfLoader.loadAsync(paths.MAZE_MODEL_PATH).then(gltf => {
                    loadedAssets.mazeModel = gltf.scene;
                    loadedAssets.mazeModel.scale.setScalar(MAZE_SCALE);
                    loadedAssets.mazeModel.position.y = MAZE_Y_OFFSET;
                    console.log(`AssetLoader: Maze model (${paths.MAZE_MODEL_PATH}) loaded.`);
                }).catch(e => { console.error(`AssetLoader: Maze model (${paths.MAZE_MODEL_PATH}) loading error:`, e); throw e; })
            );
        }

        // 2. キャラクターベースモデルの読み込み (変更なし)
        if (paths.CHARACTER_BASE_MODEL_PATH) {
            promises.push(
                this.fbxLoader.loadAsync(paths.CHARACTER_BASE_MODEL_PATH).then(object => {
                    loadedAssets.characterBaseModel = object;
                    loadedAssets.characterBaseModel.scale.setScalar(CHARACTER_INITIAL_SCALE);
                    object.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    console.log(`AssetLoader: Character base model (${paths.CHARACTER_BASE_MODEL_PATH}) loaded.`);
                }).catch(e => { console.error(`AssetLoader: Character base model (${paths.CHARACTER_BASE_MODEL_PATH}) loading error:`, e); throw e; })
            );
        }

        // 3. キャラクターアニメーションの読み込み (変更なし)
        if (paths.ANIMATION_PATHS) {
            for (const animName in paths.ANIMATION_PATHS) {
                const animPath = paths.ANIMATION_PATHS[animName];
                promises.push(
                    this.fbxLoader.loadAsync(animPath).then(object => {
                        if (object.animations && object.animations.length > 0) {
                            loadedAssets.animations[animName] = object.animations[0];
                            console.log(`AssetLoader: Character animation '${animName}' (${animPath}) loaded.`);
                        } else {
                            console.warn(`AssetLoader: Character animation file ${animPath} for '${animName}' has no animation clips.`);
                        }
                    }).catch(e => { console.error(`AssetLoader: Character animation '${animName}' (${animPath}) loading error:`, e); })
                );
            }
        }

        // 4. 敵アセットの読み込み
        const enemyKeysFound = new Set();
        for (const pathKey in paths) {
            if (pathKey.endsWith('_MODEL_PATH') && pathKey.startsWith('ENEMY_')) {
                let tempKey = pathKey.substring('ENEMY_'.length); // "001_MODEL_PATH"
                tempKey = tempKey.substring(0, tempKey.lastIndexOf('_MODEL_PATH')); // "001"
                const enemyKey = `enemy_${tempKey.toLowerCase()}`; // "enemy_001" になるように整形
                enemyKeysFound.add(enemyKey);
            }
        }
        console.log("AssetLoader: Detected enemy keys to load:", Array.from(enemyKeysFound));


        for (const enemyKey of enemyKeysFound) { // enemyKey は 'enemy_001'
            // paths オブジェクトのキーも enemyKey に合わせて生成
            // (例: enemyKey 'enemy_001' -> paths['ENEMY_001_MODEL_PATH'])
            const enemyKeyInPaths = enemyKey.replace('enemy_', '').toUpperCase(); // '001'

            const modelPathKey = `ENEMY_${enemyKeyInPaths}_MODEL_PATH`;
            const animationsPathKey = `ENEMY_${enemyKeyInPaths}_ANIMATIONS`;
            const scalePathKey = `ENEMY_${enemyKeyInPaths}_SCALE`;

            if (paths[modelPathKey]) {
                if (!loadedAssets.enemies[enemyKey]) {
                    loadedAssets.enemies[enemyKey] = { model: null, animations: {} };
                }

                const enemyScale = paths[scalePathKey] !== undefined ? paths[scalePathKey] : 1.0;
                if (paths[scalePathKey] === undefined) {
                    console.warn(`AssetLoader: Scale for enemy '${enemyKey}' (key: ${scalePathKey}) not found in paths. Defaulting to 1.0.`);
                }

                promises.push(
                    this.fbxLoader.loadAsync(paths[modelPathKey]).then(object => {
                        loadedAssets.enemies[enemyKey].model = object; // 格納時のキーは 'enemy_001'
                        loadedAssets.enemies[enemyKey].model.scale.setScalar(enemyScale);
                        object.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        console.log(`AssetLoader: Enemy model '${enemyKey}' (${paths[modelPathKey]}) loaded with scale ${enemyScale}.`);
                    }).catch(e => { console.error(`AssetLoader: Enemy model '${enemyKey}' (${paths[modelPathKey]}) loading error:`, e); throw e; })
                );

                if (paths[animationsPathKey]) {
                    for (const animName in paths[animationsPathKey]) {
                        const animPath = paths[animationsPathKey][animName];
                        promises.push(
                            this.fbxLoader.loadAsync(animPath).then(object => {
                                if (object.animations && object.animations.length > 0) {
                                    loadedAssets.enemies[enemyKey].animations[animName] = object.animations[0]; // 格納時のキーは 'enemy_001'
                                    console.log(`AssetLoader: Enemy animation '${enemyKey}/${animName}' (${animPath}) loaded.`);
                                } else {
                                    console.warn(`AssetLoader: Enemy animation file ${animPath} for '${enemyKey}/${animName}' has no animation clips.`);
                                }
                            }).catch(e => { console.error(`AssetLoader: Enemy animation '${enemyKey}/${animName}' (${animPath}) loading error:`, e); })
                        );
                    }
                } else {
                     console.log(`AssetLoader: No animation paths defined for enemy '${enemyKey}' (key: ${animationsPathKey}).`);
                }
            }
        }

        try {
            await Promise.all(promises);
            console.log("AssetLoader: All asset loading promises resolved/rejected.");
            return loadedAssets;
        } catch (error) {
            console.error("AssetLoader: Error during Promise.all in loadAll:", error);
            throw error;
        }
    }
}