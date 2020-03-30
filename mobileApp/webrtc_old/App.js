/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';

import {
  Header,
  LearnMoreLinks,
  Colors,
  DebugInstructions,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

import io from 'socket.io-client'

const dimensions = Dimensions.get('window')

if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;

// const App: () => React$Node = () => {
class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      localStream: null,
      remoteStream: null,
    }

    this.sdp
    this.socket = null
    this.candidate = []
  }

  componentDidMount = () => {

    this.socket = io(
      'https://a21bc378.ngrok.io/webrtcPeer',
      {
        path: '/io/webrtc',
        query: {}
      }
    )

    this.socket.on('connection-success', success => {
      console.log(success)
    })

    this.socket.on('offerOrAnswer', (sdp) => {

      this.sdp = JSON.stringify(sdp)
      console.log(sdp)

      // set sdp as remote description
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    })

    this.socket.on('candidate', (candidate) => {
      // console.log('From Peer... ', JSON.stringify(candidate))
      // this.candidates = [...this.candidates, candidate]
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    const pc_config = {
      "iceServers": [
        {
          "urls" : 'stun:stun.l.google.com:19302'
        }
      ]
    }

    // create an instance of RTCPeerConnection
    this.pc = new RTCPeerConnection(pc_config)

    // triggered when a new candidate is returned
    this.pc.onicecandidate = (e) => {
      // send the candidates to the remote peer
      // see addCandidate below to be triggered on the remote peer
      if (e.candidate) {
        // console.log(JSON.stringify(e.candidate))
        this.sendToPeer('candidate', e.candidate)
      }
    }

    // triggered when there is a change in connection state
    this.pc.oniceconnectionstatechange = (e) => {
      console.log(e)
    }

    // triggered when a stream is added to pc, see below - this.pc.addStream(stream)
    // this.pc.ontrack = (e) => {
    this.pc.onaddstream = (e) => {
      // this.remoteVideoref.current.srcObject = e.stream
      this.setState({
        remoteStream: e.stream
      })
    }

    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      // window.localStream = stream
      // this.localVideoref.current.srcObject = stream
      this.setState({
        localStream: stream
      })
      this.pc.addStream(stream)
    }

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }

    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if(sourceInfo.kind == "videoinput" && sourceInfo.facing == (isFront ? "front" : "environment")) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      const constraints = {
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30
          },
          facingMode: (isFront ? "user" : "environment"),
          optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
        }
      }

      mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure);
    });
  }

  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload
    })
  }

  createOffer = () => {
    console.log('Offer')

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
    // initiates the creation of SDP
    this.pc.createOffer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        // console.log(JSON.stringify(sdp))

        // set offer sdp as local description
        this.pc.setLocalDescription(sdp)

        this.sendToPeer('offerOrAnswer', sdp)
    })
  }

  createAnswer = () => {
    console.log('Answer')
    this.pc.createAnswer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        // console.log(JSON.stringify(sdp))

        // set answer sdp as local description
        this.pc.setLocalDescription(sdp)

        this.sendToPeer('offerOrAnswer', sdp)
    })
  }

  setRemoteDescription = () => {
    // retrieve and parse the SDP copied from the remote peer
    const desc = JSON.parse(this.sdp)

    // set sdp as remote description
    this.pc.setRemoteDescription(new RTCSessionDescription(desc))
  }

  addCandidate = () => {
    // retrieve and parse the Candidate copied from the remote peer
    // const candidate = JSON.parse(this.textref.value)
    // console.log('Adding candidate:', candidate)

    // add the candidate to the peer connection
    // this.pc.addIceCandidate(new RTCIceCandidate(candidate))

    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate))
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    });
  }

  render() {
    const {
      localStream,
      remoteStream,
    } = this.state

    const remoteVideo = remoteStream ?
      <RTCView
        key={2}
        mirror={true}
        style={{ ...styles.rtcViewRemote }}
        objectFit='contain'
        streamURL={remoteStream && remoteStream.toURL()}
      /> :
      <View style={{ padding: 15, }}>
        <Text style={{ fontSize:22, textAlign: 'center', color: 'white' }}>Waiting for Peer connection ...</Text>
      </View>

    return (
      <SafeAreaView style={{ flex: 1, }}>
        <View style={{...styles.buttonsContainer}}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={this.createOffer}>
              <View style={styles.button}>
                <Text style={{ ...styles.textContent, }}>Call</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={this.createAnswer}>
              <View style={styles.button}>
                <Text style={{ ...styles.textContent, }}>Answer</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ ...styles.videosContainer, }}>
          <View style={{
            position: 'absolute',
            zIndex: 1,
            bottom: 10,
            right: 10,
            width: 100, height: 200,
            backgroundColor: 'black', //width: '100%', height: '100%'
          }}>
              <View style={{flex: 1 }}>
                <TouchableOpacity onPress={() => localStream._tracks[1]._switchCamera()}>
                  <View>
                    <RTCView
                      key={1}
                      zOrder={0}
                      objectFit='cover'
                      style={{...styles.rtcView}}
                      streamURL={localStream && localStream.toURL()}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          <ScrollView style={{ ...styles.scrollView }}>
            <View style={{
              flex: 1,
              width: '100%',
              backgroundColor: '#454347',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
                { remoteVideo }
              </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  videosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    // backgroundColor: 'blue',
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
    // flexDirection: 'row',
    backgroundColor: 'teal',
    padding: 15,
  },
  button: {
    margin: 5,
    paddingVertical: 10,
    backgroundColor: 'lightgrey',
    borderRadius: 5,
  },
  textContent: {
    fontFamily: 'Avenir',
    fontSize: 20,
    textAlign: 'center',
    // marginHorizontal: 12,
    // paddingBottom: 12,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 20,
    paddingBottom: 8,
  },
  rtcView: {
    width: 100, //dimensions.width,
    height: 200,//dimensions.height / 2,
    backgroundColor: 'black',
  },
  rtcViewRemote: {
    width: dimensions.width - 30,
    height: 200,//dimensions.height / 2,
    backgroundColor: 'black',
  }
});

export default App;
