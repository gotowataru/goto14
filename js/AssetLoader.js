// AssetLoader.js

import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {
    MAZE_SCALE, MAZE_Y_OFFSET,
    CHARACTER_INITIAL_SCALE
} from './constants.js';

export class AssetLoader {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
    }

    async loadAll(paths) {
        // paths = { MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS }
        const promises = [];
        const loadedAssets = {
            mazeModel: null,
            characterBaseModel: null,
            animations: {}
        };

        // 迷路モデルの読み込み
        promises.push(
            this.gltfLoader.loadAsync(paths.MAZE_MODEL_PATH).then(gltf => {
                loadedAssets.mazeModel = gltf.scene;
                loadedAssets.mazeModel.scale.setScalar(MAZE_SCALE);
                loadedAssets.mazeModel.position.y = MAZE_Y_OFFSET;
                // console.log("迷路モデル読み込み完了 (AssetLoader).");
            }).catch(e => { console.error(`迷路 (${paths.MAZE_MODEL_PATH}) 読込エラー:`, e); throw e; })
        );

        // キャラクターベースモデルの読み込み
        promises.push(
            this.fbxLoader.loadAsync(paths.CHARACTER_BASE_MODEL_PATH).then(object => {
                loadedAssets.characterBaseModel = object;
                // スケールやシャドウ設定はCharacterクラスまたはGameクラスで行う方が一貫性があるかもしれない
                // ここではスケールのみ設定しておく
                loadedAssets.characterBaseModel.scale.setScalar(CHARACTER_INITIAL_SCALE);
                object.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                // console.log("キャラクターベースモデル読み込み完了 (AssetLoader).");
            }).catch(e => { console.error(`キャラクターベースモデル (${paths.CHARACTER_BASE_MODEL_PATH}) 読込エラー:`, e); throw e; })
        );

        // アニメーションの読み込み
        for (const name in paths.ANIMATION_PATHS) {
            const path = paths.ANIMATION_PATHS[name];
            promises.push(
                this.fbxLoader.loadAsync(path).then(object => {
                    if (object.animations && object.animations.length > 0) {
                        loadedAssets.animations[name] = object.animations[0];
                        // console.log(`アニメーション ${name} 読み込み完了 (AssetLoader)`);
                    } else {
                        console.warn(`アニメーションファイル ${path} にアニメーションクリップが見つかりませんでした (${name})`);
                    }
                }).catch(e => { console.error(`アニメーション ${name} (${path}) 読込エラー:`, e); /* throw e; エラーでも続行する場合 */ })
            );
        }

        try {
            await Promise.all(promises);
            console.log("全てのアセット読み込み試行完了 (AssetLoader).");


            // --- ★★★ 追加箇所 ★★★ ---
            console.log("AssetLoader: Final 'loadedAssets.animations' being returned:",
                JSON.parse(JSON.stringify(loadedAssets.animations, (key, value) => {
                    if (value instanceof THREE.AnimationClip) {
                        // AnimationClipの主要な情報のみを文字列化
                        return `AnimationClip[name:${value.name}, duration:${value.duration.toFixed(2)}s, tracks:${value.tracks.length}]`;
                    }
                    if (value === null) return "AnimationClip[null]"; // FBXにアニメーションがなかった場合など
                    return value; // それ以外の値はそのまま
                }))
            );
            // --- ★★★ 追加箇所ここまで ★★★ ---


            return loadedAssets;
        } catch (error) {
            console.error("アセット読み込み中にエラーが発生しました (AssetLoader):", error);
            // ローディングメッセージの更新などはGameクラスで行う
            throw error; // エラーを上位に伝播
        }
    }
}