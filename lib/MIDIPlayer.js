

function MIDIPlayer(fileinput, onload, baseURL) {

    let audioContext = null;
    let player = null;
    let reverberator = null;
    let songStart = 0;
    let input = null;
    let currentSongTime = 0;
    let nextStepTime = 0;
    let nextPositionTime = 0;
    let loadedsong = null;
    let stoppedsong = null;
    let stepDuration = 44 / 1000;
    let lastPosition = 0;
    let self = this;

    this.currentPosition = 0;
    this.duration = 0;
    this.onload = onload;
    this.STOPPED = "stopped";
    this.PLAYING = "playing";
    this.PAUSED = "paused";
    this.baseURL = baseURL;

    this.monitor = null;


    this.log = function (msg, extra) {
        console.log(msg, extra);
    }

    this.play = function () {
        if (!loadedsong && stoppedsong) {
            loadedsong = stoppedsong;
        }
        if (loadedsong) {
            try {
                this.startPlay(loadedsong);
                if (this.state == this.PAUSED) {
                    this.setPosition(lastPosition);
                }
                this.state = this.PLAYING;
            } catch (expt) {
                this.log('error ', expt);
            }
        }
    }
    this.pause = function () {
        if (loadedsong) {
            lastPosition = this.getPosition();
            console.log("Position", lastPosition);
            this.stop();
            currentSongTime = lastPosition;
            this.state = this.PAUSED;
        }
    }
    this.stop = function () {
        if (loadedsong) {
            player.cancelQueue(audioContext);
            songStart = 0;
            currentSongTime = 0;
            stoppedsong = loadedsong;
            loadedsong = null;
            this.state = this.STOPPED;
        }
    }
    this.getContext = function () {
        return player;
    }
    this.startPlay = function (song) {
        currentSongTime = 0;
        songStart = audioContext.currentTime;
        nextStepTime = audioContext.currentTime;

        this.tick(song, stepDuration);
    }

    this.tick = function (song, stepDuration) {
        if (audioContext.currentTime > nextStepTime - stepDuration) {
            this.sendNotes(song, songStart, currentSongTime, currentSongTime + stepDuration, audioContext, input, player);
            currentSongTime = currentSongTime + stepDuration;
            nextStepTime = nextStepTime + stepDuration;
            if (currentSongTime > song.duration) {
                currentSongTime = currentSongTime - song.duration;
                this.sendNotes(song, songStart, 0, currentSongTime, audioContext, input, player);
                songStart = songStart + song.duration;
            }
        }
        if (nextPositionTime < audioContext.currentTime) {
            this.currentPosition = currentSongTime;
            this.duration = song.duration;
            nextPositionTime = audioContext.currentTime + 3;
        }
        if (this.ontick) {
            this.ontick(loadedsong, currentSongTime);
        }
        setTimeout(function () {
            if (loadedsong) {
                self.tick(loadedsong, stepDuration);
            }
        }, 10);
    }
    this.sendNotes = function (song, songStart, start, end, audioContext, input, player) {
        for (let t in song.tracks) {
            let track = song.tracks[t];
            for (let i in track.notes) {
                if (track.notes[i].when >= start && track.notes[i].when < end) {
                    let when = songStart + track.notes[i].when;
                    let duration = track.notes[i].duration;
                    if (duration > 3) {
                        duration = 3;
                    }
                    let instr = track.info.variable;
                    let v = track.volume / 7;
                    player.queueWaveTable(audioContext, input, window[instr], when, track.notes[i].pitch, duration, v, track.notes[i].slides);
                    if (this.monitor) {
                        this.monitor(
                            'note',               //1
                            audioContext,         //2
                            input,                //3
                            window[instr],        //4
                            when,                 //5
                            track.notes[i],       //6
                            duration,             //7
                            v,                    //8
                            track.notes[i].slides //9
                            );
                    }
                }
            }
        }
        for (let b in song.beats) {
            let beat = song.beats[b];
            for (let i in beat.notes) {
                if (beat.notes[i].when >= start && beat.notes[i].when < end) {
                    let when = songStart + beat.notes[i].when;
                    let duration = 1.5;
                    let instr = beat.info.variable;
                    let v = beat.volume / 2;
                    player.queueWaveTable(audioContext, input, window[instr], when, beat.n, duration, v);
                    if (this.monitor) {
                        this.monitor(
                            'beat',        //1
                            audioContext,  //2
                            input,         //3
                            window[instr], //4
                            when,          //5
                            beat.notes[i], //6
                            duration,      //7
                            v              //8
                            );
                    }
                }
            }
        }
    }
    this.startLoad = function (song) {
        console.log(song);
        let AudioContextFunc = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextFunc();
        player = new WebAudioFontPlayer();
        reverberator = player.createReverberator(audioContext);
        reverberator.output.connect(audioContext.destination);
        input = reverberator.input;
        for (let i in song.tracks) {
            let nn = player.loader.findInstrument(song.tracks[i].program);
            let info = player.loader.instrumentInfo(nn, this.baseURL);
            console.log('TRACK ', i, nn, info);
            song.tracks[i].info = info;
            song.tracks[i].id = nn;
            player.loader.startLoad(audioContext, info.url, info.variable);
        }
        for (let i in song.beats) {
            let nn = player.loader.findDrum(song.beats[i].n);
            let info = player.loader.drumInfo(nn, this.baseURL);
            song.beats[i].info = info;
            song.beats[i].id = nn;
            player.loader.startLoad(audioContext, info.url, info.variable);
        }
        player.loader.waitLoad(function () {
            self.loadSong(song);
        });
    }
    this.getCurrentSong = function () {
        return loadedsong;
    }
    this.getPosition = function () {
        return currentSongTime;
    }
    this.setPosition = function (position) {
        if (loadedsong || stoppedsong) {
            player.cancelQueue(audioContext);
            let next = position;
            songStart = songStart - (next - currentSongTime);
            currentSongTime = next;
            lastPosition = currentSongTime;
        }
    }
    this.setVolume = function (volume) {
        if (loadedsong) {
            player.cancelQueue(audioContext);
            let v = volume / 100;
            if (v < 0.000001) {
                v = 0.000001;
            }
            loadedsong.tracks[i].volume = v;
        }
    }
    this.setInstrument = function (value) {
        if (loadedsong) {
            let nn = value;
            let info = player.loader.instrumentInfo(nn, this.baseURL);
            player.loader.startLoad(audioContext, info.url, info.variable);
            player.loader.waitLoad(function () {
                loadedsong.tracks[i].info = info;
                loadedsong.tracks[i].id = nn;
            });
        }
    }
    this.loadSong = function (song) {
        this.stop();
        audioContext.resume();

        console.log("Tracks", song.tracks);
        console.log("Beats", song.beats);
        console.log("Duration", song.duration);
        console.log("Instruments", player.loader.instrumentKeys());
        console.log("Drums", player.loader.drumKeys());
        loadedsong = song;
        if (this.onload) {
            this.onload(song)
        }
    }
    this.openFile = function (fileObj) {
        let midiFile = new MIDIFile(fileObj);
        let song = midiFile.parseSong();
        self.startLoad(song);
    }
    this.handleFileSelect = function (event) {
        let self = this;
        console.log(event);
        let file = event.target.files[0];
        console.log(file);
        let fileReader = new FileReader();
        fileReader.onload = function (event) {
            console.log(event);
            let fileObj = event.target.result;
            self.openFile(fileObj);
            if(typeof self.callbackSelectFile == 'function')
            {
                self.callbackSelectFile(fileObj);
            }
        };
        fileReader.readAsArrayBuffer(file);
    }
    this.handleUrl = function (path) {
        console.log(path);
        let xmlHttpRequest = new XMLHttpRequest();
        xmlHttpRequest.open("GET", path, true);
        xmlHttpRequest.responseType = "arraybuffer";
        xmlHttpRequest.onload = function (e) {
            let arrayBuffer = xmlHttpRequest.response;
            let midiFile = new MIDIFile(arrayBuffer);
            let song = midiFile.parseSong();
            self.startLoad(song);
            if(typeof self.callbackSelectUrl == 'function')
            {
                self.callbackSelectUrl(arrayBuffer, path);
            }
        };
        xmlHttpRequest.send(null);
    }

    this.callbackSelectUrl = function(arrayBuffer, pathMidi, pathXml)
    {
        

    };
    this.callbackSelectFile = function(fileObj)
    {

    };

    if (typeof (fileinput) == "string") {
        fileinput = document.getElementById(fileinput)
    }
    if (fileinput) {

        fileinput.addEventListener('change', this.handleFileSelect.bind(this), false);
    }

}