const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
const showChat = document.querySelector("#showChat");
const backBtn = document.querySelector(".header__back");
const closeBtn = document.querySelector('#close')
const NameBtn = document.querySelector('#inputName #User')
const DisplayBtn = document.querySelector('#inputName #Display')
const nameInput = document.querySelector('#inputName input')
const userlist = document.querySelector('#userlist')
const userlistOpenBtn = document.querySelector('#userlist-open-btn')
const userlistCloseBtn = document.querySelector('#userlist-close-btn')

myVideo.setAttribute('muted',true)
myVideo.setAttribute('controls','controls')
myVideo.setAttribute('autoplay',true )
myVideo.className = 'my-video'


//兼容问题
if (navigator.mediaDevices === undefined) {
  navigator.mediaDevices = {};
}
if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
    var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;
    if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
    }
    return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
    });
  }
}
DisplayBtn.addEventListener('click',()=>{
  myUserName = nameInput.value
  myUserName.trim() && myUserName.trim() !=='系统消息' && start(myUserName,'Display')
})
NameBtn.addEventListener('click',()=>{
  myUserName = nameInput.value
  myUserName.trim() && myUserName.trim() !=='系统消息' && start(myUserName,'User')
})
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    myUserName = nameInput.value
    myUserName.trim() && myUserName.trim() !=='系统消息' && start(myUserName,'User')
  }
});

let myUserName = ''
let myUserId = ''
let callers = [] //发起call的用户实例mediaConnection
let rooms = []


function start(user,type) {
  document.querySelector('#inputName').style.display = 'none'
  backBtn.addEventListener("click", () => {
    document.querySelector(".main__left").style.display = "flex";
    document.querySelector(".main__left").style.flex = "1";
    document.querySelector(".main__right").style.display = "none";
    document.querySelector(".header__back").style.display = "none";
  });
  
  showChat.addEventListener("click", () => {
    document.querySelector(".main__right").style.display = "flex";
    document.querySelector(".main__right").style.flex = "1";
    document.querySelector(".main__left").style.display = "none";
    document.querySelector(".header__back").style.display = "block";
  });
    
  var peer = new Peer(undefined, {
    path: "/peerjs",
    host: "/",
    port: "443",
    config: {'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'turn:124.222.237.55:3478',username:'chart', credential: '13131414' }
    ]}, /* Sample servers, please use appropriate ones */
    debug:2,
  });
  peer.on("open", (id) => {
    myUserId = id
    renderUsersList([{userId:id,userName:myUserName}])
    socket.emit("join-room", ROOM_ID, id, user);
  });

  let myVideoStream;
  const constraints = {
    audio: {
      noiseSuppression: true,
      echoCancellation: true,
      channelCount:1,
    },
    video: true,
  }
  const promise = type === "User"? navigator.mediaDevices.getUserMedia(constraints): navigator.mediaDevices.getDisplayMedia(constraints)
  promise.then((stream) => {
    myVideoStream = stream;
    const div = document.createElement('div')
    const span = document.createElement('span')
    span.innerHTML = `${myUserName}(我)`
    div.appendChild(myVideo)
    div.appendChild(span)
    addVideoStream(div, stream);

    peer.on("call", (call) => {
      //响应对等体并判断是否是第一次call，
      // 第一次需要保存对等体并创建视频流响应事件
      call.answer(stream);
      if (rooms.findIndex(c=>c.userId === call.peer) === -1 && (call.metadata.myUserId === call.peer)) {
        callers.push(call)
        const div = document.createElement('div')
        const video = document.createElement("video");
        const span = document.createElement('span')
        span.innerHTML = call.metadata.myUserName
        video.setAttribute('muted',true )
        video.setAttribute('autoplay',true )
        video.setAttribute('controls','controls')
        div.appendChild(video)
        div.appendChild(span)
        div.setAttribute('id',call.metadata.myUserId)
        console.log('被叫',call)
        rooms.push({userId:call.peer})
        call.on("stream", (userVideoStream) => {
          addVideoStream(div, userVideoStream);
        });
      }
    });
    
    socket.on("user-connected", (userId,userName,Rooms) => {
      //把收到的房间里所有的人去循环建立视频链接
      const reqConn = Rooms.filter(u=>{
        return (u.userId !== myUserId) && (rooms.findIndex(c=>c.userId === u.userId) === -1)
      })
      reqConn.forEach((u,i) => {
        setTimeout(() => {
          connectToNewUser(u.userId,stream,u.userName)
        }, 500*i);
      });
      console.log('需要连接的对象',reqConn);
      renderUsersList(Rooms)
    });
    return navigator.mediaDevices.enumerateDevices();
  })
  //当关闭页面时发送id给socket
  window.onbeforeunload = ()=>{
    socket.disconnect()
  }
  window.addEventListener("unload", ()=>{
    socket.disconnect()
  })

  //与用户建立视频链接
  const connectToNewUser = (userId, stream, userName , once) => {
    //WebRTC的媒体流
    let conn = peer.call(userId, stream, {metadata:{myUserId,myUserName}}),
    userVideoStream
    conn.on("stream", (VideoStream) => {
      userVideoStream = VideoStream
    });
    //等待时间
    let reConnectionNum = 10 //次数
    const connectionWaitTime = 1000 // s
    const timer = setInterval(() => {
      reConnectionNum -= 1
      if (conn.open) {
        socket.emit("message",`${myUserName} —> ${userName} -视频通话连接成功！` );
        addConnectionV ({userId, userVideoStream, userName})
        clearInterval(timer)
      }else if(reConnectionNum <= 0){
        clearInterval(timer)
        console.log('连接失败');
        conn.close()
        !once && connectToNewUser(userId, stream, userName ,true)
      }
    },connectionWaitTime)
  };
  
  
  //
  const addConnectionV = ({userId, userVideoStream, userName})=>{
    const div = document.createElement('div')
    const video = document.createElement("video");
    const span = document.createElement('span')
    span.innerHTML = userName
    video.setAttribute('muted',true)
    video.setAttribute('autoplay',true )
    video.setAttribute('controls','controls')
    div.setAttribute('id',userId)
    div.appendChild(video)
    div.appendChild(span)
    addVideoStream(div, userVideoStream);
  }
  //添加video元素到videoGrid
  const addVideoStream = (videoCotainer, stream) => {
    console.log(stream.getAudioTracks());
    const video = videoCotainer.firstElementChild
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
      video.play();
      videoGrid.append(videoCotainer);
    });
  };
  
  
  
  let text = document.querySelector("#chat_message");
  let send = document.getElementById("send");
  let messages = document.querySelector(".messages");
  
  send.addEventListener("click", (e) => {
    if (text.value.length !== 0) {
      socket.emit("message", text.value);
      text.value = "";
    }
  });
  
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && text.value.length !== 0) {
      socket.emit("message", text.value);
      text.value = "";
    }
  });
  
  const inviteButton = document.querySelector("#inviteButton");
  const muteButton = document.querySelector("#muteButton");
  const stopVideo = document.querySelector("#stopVideo");
  muteButton.addEventListener("click", () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
      myVideoStream.getAudioTracks()[0].enabled = false;
      html = `<i class="fas fa-microphone-slash"></i>`;
      muteButton.classList.toggle("background__red");
      muteButton.innerHTML = html;
    } else {
      myVideoStream.getAudioTracks()[0].enabled = true;
      html = `<i class="fas fa-microphone"></i>`;
      muteButton.classList.toggle("background__red");
      muteButton.innerHTML = html;
    }
  });
  
  stopVideo.addEventListener("click", () => {
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
      myVideoStream.getVideoTracks()[0].enabled = false;
      html = `<i class="fas fa-video-slash"></i>`;
      stopVideo.classList.toggle("background__red");
      stopVideo.innerHTML = html;
    } else {
      myVideoStream.getVideoTracks()[0].enabled = true;
      html = `<i class="fas fa-video"></i>`;
      stopVideo.classList.toggle("background__red");
      stopVideo.innerHTML = html;
    }
  });
  
  inviteButton.addEventListener("click", (e) => {
    prompt(
      "拷贝这个连接发送给你想见的人！",
      window.location.href
    );
  });

  //当有用户关闭页面时从房间移除
  socket.on("leave-room",(userId, userName, Rooms)=>{
    console.log(callers.find(c=>c.peer === userId));
    callers.find(c=>c.peer === userId)?.close()
    const child = document.getElementById(userId)
    if (child) {
      document.querySelector('#video-grid').removeChild(child)
    }
    renderUsersList(Rooms)
  })
  //渲染用户列表
  const renderUsersList = (Rooms) => {
    rooms = Rooms
    document.querySelector('#userlist ul').innerHTML = rooms.map(item=>(`
      <li>
      <i class="far fa-user-circle"></i>
      <span class="list-userName">${item.userName}</span>
      </li>
    `))
  }
  userlistOpenBtn.addEventListener('click',()=>{
    userlist.style.display = 'block'
  })
  userlistCloseBtn.addEventListener('click',()=>{
    userlist.style.display = 'none'
  })

  socket.on("createMessage", (message, userName) => {
    messages.innerHTML =
      messages.innerHTML +
      `<div class="message">
          <b><i class="far fa-user-circle"></i> <span> ${
            userName === user ? `${userName}(我)` : userName
          }</span> </b>
          <span>${message}</span>
      </div>`;
  });
}
