const APP_ID = "1ce697618a6948bd83808551fcbd636b";
const token = null;
const uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get("room");

if (!roomId) window.location = "loby.html";

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun1.2.google.com:19302"],
    },
  ],
};

const mediaConstrains = {
  video: {
    witdh: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: true,
};

const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia(mediaConstrains);
  document.getElementById("user-1").srcObject = localStream;
};

const handleUserJoined = async (MemberId) => {
  await createOffer(MemberId);
};

const handleUserLeft = () => {
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("smallFrame");
};

const handleMessageFromPeer = (message, MemberId) => {
  message = JSON.parse(message.text);

  if (message.type === "offer") createAnswer(MemberId, message.offer);
  if (message.type === "answer") addAnswer(message.answer);
  if (message.type === "candidate") {
    // if (peerConnection) {
    peerConnection.addIceCandidate(message.candidate);
    // }
  }
};

const createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";
  document.getElementById("user-1").classList.add("smallFrame");

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberId
      );
    }
  };
};

const createOffer = async (MemberId) => {
  await createPeerConnection(MemberId);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer }) },
    MemberId
  );
};

const createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer }) },
    MemberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

const cameraBtn = document.getElementById("camera-btn");
const micBtn = document.getElementById("mic-btn");

const toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    cameraBtn.style.backgroundColor = "red";
  } else {
    videoTrack.enabled = true;
    cameraBtn.style.backgroundColor = "teal";
  }
};

const toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    micBtn.style.backgroundColor = "red";
  } else {
    audioTrack.enabled = true;
    micBtn.style.backgroundColor = "teal";
  }
};

cameraBtn.addEventListener("click", toggleCamera);
micBtn.addEventListener("click", toggleMic);

window.addEventListener("beforeunload", leaveChannel);

init();
