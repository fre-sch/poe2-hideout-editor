import * as THREE from "three"
import * as constants from "hideoutEditor/constants.module.js"

const POE_TO_RADIAN = (2 * Math.PI) / 65536
const RADIAN_TO_POE = 65536 / (2 * Math.PI)
const RAD2DEG = 180 / Math.PI

export class Hideout {
  constructor() {
    this.sceneObj = new THREE.Group()
    this.sceneObj.name = "HideoutGroup"
    this.sceneObj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    this.geometry = null
    this.objectColors = {
      normal: 0x008080,
      selected: 0xC0C000,
    }
    this.lineColors = {
      normal: 0x00FFFF,
      selected: 0xFFFF00,
    }
    this.bbox = new THREE.Box3()
    this.numDoodads = 0
  }

  setGeometry (geometry) {
    this.geometry = geometry
    this.geometry.computeBoundingSphere()
  }

  load (hideoutData) {
    this.sceneObj.userData = hideoutData
    this.bbox.makeEmpty()
    this.sceneObj.clear()
    for (const doodadItem of hideoutData.doodads) {
      const [doodadName, doodadData] = doodadItem

      const doodadObj = new THREE.Group()
      doodadObj.userData = { ...doodadData, isDoodad: true }
      this.makeDoodadVisual(doodadObj, doodadName)
      doodadObj.setSelected = (selected) => {
        if (selected) {
          doodadObj?.children[0]?.material.color.setHex(this.objectColors.selected)
          doodadObj?.children[1]?.material.color.setHex(this.lineColors.selected)
        }
        else {
          doodadObj?.children[0]?.material.color.setHex(this.objectColors.normal)
          doodadObj?.children[1]?.material.color.setHex(this.lineColors.normal)
        }
      }
      doodadObj.name = doodadName
      doodadObj.position.set(doodadData.y, 0, doodadData.x)
      doodadObj.rotation.y = doodadData.r * POE_TO_RADIAN
      doodadObj.layers.enable(constants.LAYER_LABELED)
      doodadObj.layers.enable(constants.LAYER_PICKABLE)
      this.sceneObj.add(doodadObj)
    }
    this.bbox.setFromObject(this.sceneObj)
    const bboxCenter = new THREE.Vector3()
    this.bbox.getCenter(bboxCenter)
    return bboxCenter
  }

  makeDoodadVisual (parent) {
    const mesh = new THREE.Mesh(this.geometry,
      new THREE.MeshBasicMaterial({ color: this.objectColors.normal })
    )
    const edges = new THREE.EdgesGeometry(this.geometry)
    const lines = new THREE.LineSegments(edges,
      new THREE.LineBasicMaterial({ color: this.lineColors.normal })
    )
    mesh.renderOrder = 90
    lines.renderOrder = 99
    parent.add(mesh)
    parent.add(lines)
  }

  attach (scene) {
    scene.add(this.sceneObj)
  }

  serializeDoodads () {
    const doodads = []
    let euler = new THREE.Euler()
    let child
    for (let i = 0; i < this.sceneObj.children.length; i++) {
      child = this.sceneObj.children[i]
      const { isDoodad, ...doodad } = child.userData
      if (!isDoodad) continue
      euler.setFromQuaternion(child.quaternion, "YXZ")
      doodad.x = Math.round(child.position.z)
      doodad.y = Math.round(child.position.x)
      doodad.r = (Math.round(euler.y * RADIAN_TO_POE) + 65536) % 65536
      doodads.push([child.name, doodad])
    }
    return doodads
  }
}
