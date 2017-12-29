import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  DeviceEventEmitter, // android
  NativeAppEventEmitter, // ios
  NativeModules,
  Platform,
  requireNativeComponent,
  View,
  ViewPropTypes,
  Dimensions
} from 'react-native';
import BarcodeFinder from './barcode-finder';

const {height, width} = Dimensions.get('window');
const CameraManager = NativeModules.CameraManager || NativeModules.CameraModule;
const CAMERA_REF = 'camera';

function convertNativeProps(props) {
  const newProps = { ...props };
  if (typeof props.aspect === 'string') {
    newProps.aspect = Camera.constants.Aspect[props.aspect];
  }

  if (typeof props.flashMode === 'string') {
    newProps.flashMode = Camera.constants.FlashMode[props.flashMode];
  }

  if (typeof props.orientation === 'string') {
    newProps.orientation = Camera.constants.Orientation[props.orientation];
  }

  if (typeof props.torchMode === 'string') {
    newProps.torchMode = Camera.constants.TorchMode[props.torchMode];
  }

  if (typeof props.type === 'string') {
    newProps.type = Camera.constants.Type[props.type];
  }

  if (typeof props.captureQuality === 'string') {
    newProps.captureQuality = Camera.constants.CaptureQuality[props.captureQuality];
  }

  if (typeof props.captureMode === 'string') {
    newProps.captureMode = Camera.constants.CaptureMode[props.captureMode];
  }

  if (typeof props.captureTarget === 'string') {
    newProps.captureTarget = Camera.constants.CaptureTarget[props.captureTarget];
  }

  // do not register barCodeTypes if no barcode listener
  if (typeof props.onBarCodeRead !== 'function') {
    newProps.barCodeTypes = [];
  }

  newProps.barcodeScannerEnabled = typeof props.onBarCodeRead === 'function'

  return newProps;
}


export default class Camera extends Component {

  static constants = {
    Aspect: CameraManager.Aspect,
    BarCodeType: CameraManager.BarCodeType,
    Type: CameraManager.Type,
    CaptureMode: CameraManager.CaptureMode,
    CaptureTarget: CameraManager.CaptureTarget,
    CaptureQuality: CameraManager.CaptureQuality,
    Orientation: CameraManager.Orientation,
    FlashMode: CameraManager.FlashMode,
    TorchMode: CameraManager.TorchMode
  };

  static propTypes = {
    ...ViewPropTypes,
    aspect: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureAudio: PropTypes.bool,
    captureMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureQuality: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureTarget: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    defaultOnFocusComponent: PropTypes.bool,
    flashMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    keepAwake: PropTypes.bool,
    onBarCodeRead: PropTypes.func,
    barcodeScannerEnabled: PropTypes.bool,
    onFocusChanged: PropTypes.func,
    onZoomChanged: PropTypes.func,
    mirrorImage: PropTypes.bool,
    fixOrientation: PropTypes.bool,
    barCodeTypes: PropTypes.array,
    orientation: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    playSoundOnCapture: PropTypes.bool,
    torchMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    type: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    barcodeFinderVisible: PropTypes.bool,
    barcodeFinderWidth: PropTypes.number,
    barcodeFinderHeight: PropTypes.number,
    barcodeFinderStyle: PropTypes.object,
    barcodeFinderPercentageSize: PropTypes.array,
  };

  static defaultProps = {
    aspect: CameraManager.Aspect.fill,
    type: CameraManager.Type.back,
    orientation: CameraManager.Orientation.auto,
    fixOrientation: false,
    captureAudio: false,
    captureMode: CameraManager.CaptureMode.still,
    captureTarget: CameraManager.CaptureTarget.cameraRoll,
    captureQuality: CameraManager.CaptureQuality.high,
    defaultOnFocusComponent: true,
    flashMode: CameraManager.FlashMode.off,
    playSoundOnCapture: true,
    torchMode: CameraManager.TorchMode.off,
    mirrorImage: false,
    barCodeTypes: Object.values(CameraManager.BarCodeType),
    barcodeFinderVisible: false,
    barcodeFinderWidth: 200,
    barcodeFinderHeight: 200,
    barcodeFinderStyle: {borderColor: "rgba(255,255,255,0.6)", borderWidth: 1},
    barcodeFinderComponent: <BarcodeFinder />
  };

  static checkDeviceAuthorizationStatus = CameraManager.checkDeviceAuthorizationStatus;
  static checkVideoAuthorizationStatus = CameraManager.checkVideoAuthorizationStatus;
  static checkAudioAuthorizationStatus = CameraManager.checkAudioAuthorizationStatus;

  setNativeProps(props) {
    this.refs[CAMERA_REF].setNativeProps(props);
  }

  constructor() {
    super();
    this.state = {
      isAuthorized: false,
      isRecording: false
    };
  }

  async componentWillMount() {
    this._addOnBarCodeReadListener()

    let { captureMode } = convertNativeProps({ captureMode: this.props.captureMode })
    let hasVideoAndAudio = this.props.captureAudio && captureMode === Camera.constants.CaptureMode.video
    let check = hasVideoAndAudio ? Camera.checkDeviceAuthorizationStatus : Camera.checkVideoAuthorizationStatus;

    if (check) {
      const isAuthorized = await check();
      this.setState({ isAuthorized });
    }
  }

  componentWillUnmount() {
    this._removeOnBarCodeReadListener()

    if (this.state.isRecording) {
      this.stopCapture();
    }
  }

  componentWillReceiveProps(newProps) {
    const { onBarCodeRead } = this.props
    if (onBarCodeRead !== newProps.onBarCodeRead) {
      this._addOnBarCodeReadListener(newProps)
    }
  }

  _addOnBarCodeReadListener(props) {
    const { onBarCodeRead } = props || this.props
    this._removeOnBarCodeReadListener()
    if (onBarCodeRead) {
      this.cameraBarCodeReadListener = Platform.select({
        ios: NativeAppEventEmitter.addListener('CameraBarCodeRead', this._onBarCodeRead),
        android: DeviceEventEmitter.addListener('CameraBarCodeReadAndroid',  this._onBarCodeRead)
      })
    }
  }
  _removeOnBarCodeReadListener() {
    const listener = this.cameraBarCodeReadListener
    if (listener) {
      listener.remove()
    }
  }

  _child(){
    var props = {
      style: this.props.barcodeFinderStyle,
      width: this.props.barcodeFinderWidth,
      height: this.props.barcodeFinderHeight
    }
    return React.cloneElement(this.props.barcodeFinderComponent, props);
  }

  render() {
    // Should we show barcode finder, use in child or use default
    var childs = null;
    var barcodeFinderPercentageSize = [0,0];
    if(this.props.barcodeFinderVisible){
      // we need % size of viewFinder
      barcodeFinderPercentageSize = [(this.props.barcodeFinderWidth/width),(this.props.barcodeFinderHeight/height)]
      childs = <View style={{left:0,right:0,bottom:0,top:0,position:'absolute',justifyContent:'center',alignItems:'center'}}><View style={{width:this.props.barcodeFinderWidth,height:this.props.barcodeFinderHeight}}>{this._child()}</View></View>;
    }
    const nativeProps = convertNativeProps(Object.assign({},this.props,{barcodeFinderPercentageSize}));
    return (<View style={{flex:1}}>
              <View style={{flex:1}}>
                <RCTCamera ref={CAMERA_REF} {...nativeProps} />
              </View>
              {childs}
            </View>);
  }
  _onBarCodeRead = (data) => {
    if (this.props.onBarCodeRead) {
      this.props.onBarCodeRead(data)
    }
  };

  capture(options) {
    const props = convertNativeProps(this.props);
    options = {
      audio: props.captureAudio,
      barCodeTypes: props.barCodeTypes,
      mode: props.captureMode,
      playSoundOnCapture: props.playSoundOnCapture,
      target: props.captureTarget,
      quality: props.captureQuality,
      type: props.type,
      title: '',
      description: '',
      mirrorImage: props.mirrorImage,
      fixOrientation: props.fixOrientation,
      ...options
    };

    if (options.mode === Camera.constants.CaptureMode.video) {
      options.totalSeconds = (options.totalSeconds > -1 ? options.totalSeconds : -1);
      options.preferredTimeScale = options.preferredTimeScale || 30;
      this.setState({ isRecording: true });
    }

    return CameraManager.capture(options);
  }

  stopCapture() {
    if (this.state.isRecording) {
      this.setState({ isRecording: false });
      return CameraManager.stopCapture();
    }
    return Promise.resolve("Not Recording.");
  }

  getFOV() {
    return CameraManager.getFOV();
  }

  hasFlash() {
    if (Platform.OS === 'android') {
      const props = convertNativeProps(this.props);
      return CameraManager.hasFlash({
        type: props.type
      });
    }
    return CameraManager.hasFlash();
  }
}

export const constants = Camera.constants;

const RCTCamera = requireNativeComponent('RCTCamera', Camera, {nativeOnly: {
  testID: true,
  renderToHardwareTextureAndroid: true,
  accessibilityLabel: true,
  importantForAccessibility: true,
  accessibilityLiveRegion: true,
  accessibilityComponentType: true,
  onLayout: true
}});
