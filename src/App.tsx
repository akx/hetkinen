import React from "react";
import useSWR from "swr";
import headWav from "./head.wav";
import loopWav from "./loop.wav";
import tailWav from "./tail.wav";
import convolutionWav from "./teufelsberg.wav";

function useSampleData(audioContext: AudioContext, src: string) {
  return useSWR(src, async () => {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Failed to fetch audio");
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
  });
}

function midiNoteToPitch(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function midiNoteToName(note: number) {
  const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octave = Math.floor(note / 12) - 1;
  const name = names[note % 12];
  return `${name}${octave}`;
}

function stopSourceRef(
  sourceRef: React.MutableRefObject<AudioBufferSourceNode | null>,
) {
  const headSource = sourceRef.current;
  if (headSource) {
    try {
      headSource.stop();
    } catch (e) {
      // maybe never started
    }
    headSource.disconnect();
  }
  sourceRef.current = null;
}

function createSourceNode(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  pitch: number,
  destinationNodes: AudioNode[],
  loop = false,
) {
  const node = audioContext.createBufferSource();
  node.buffer = buffer;
  node.loop = loop;
  node.playbackRate.value = pitch;
  for (const destinationNode of destinationNodes) {
    node.connect(destinationNode);
  }
  return node;
}

interface NoteButtonProps {
  tone: number;
  octave: number;
  audioContext: AudioContext;
  destinationNodes: AudioNode[];
  head: AudioBuffer;
  loop: AudioBuffer;
  tail: AudioBuffer;
}

function NoteButton(props: NoteButtonProps) {
  const { octave, tone, audioContext, destinationNodes, head, loop, tail } =
    props;

  const note = 60 + octave * 12 + tone;
  const headSourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const loopSourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const tailSourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const start = () => {
    if (audioContext.state !== "running") {
      audioContext.resume();
    }
    const pitch = midiNoteToPitch(note) / midiNoteToPitch(60);
    const headSource = createSourceNode(
      audioContext,
      head,
      pitch,
      destinationNodes,
    );
    headSource.start();
    headSourceRef.current = headSource;
    const loopSource = createSourceNode(
      audioContext,
      loop,
      pitch,
      destinationNodes,
      true,
    );
    loopSource.loop = true;
    loopSourceRef.current = loopSource;
    const tailSource = createSourceNode(
      audioContext,
      tail,
      pitch,
      destinationNodes,
    );
    tailSourceRef.current = tailSource;
    headSource.addEventListener("ended", () => {
      loopSource.start();
    });
    const button = buttonRef.current;
    if (button) button.style.transform = "scale(0.8)";
  };
  const stop = () => {
    const button = buttonRef.current;
    if (button) button.style.transform = "scale(1)";
    stopSourceRef(headSourceRef);
    stopSourceRef(loopSourceRef);
    const tailSource = tailSourceRef.current;
    if (tailSource) {
      try {
        tailSource?.start();
      } catch (e) {
        // maybe already started
      }
      tailSource.onended = () => stopSourceRef(tailSourceRef);
    }
  };
  return (
    <button
      style={{ fontSize: `${100 * (1 - Math.abs(octave * 0.2))}%` }}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseOut={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      ref={buttonRef}
    >
      {midiNoteToName(note)}
    </button>
  );
}

function App() {
  const [audioContext] = React.useState(() => new AudioContext());
  const [destinationNodes, setDestinationNodes] = React.useState<AudioNode[]>([
    audioContext.destination,
  ]);
  const head = useSampleData(audioContext, headWav);
  const loop = useSampleData(audioContext, loopWav);
  const tail = useSampleData(audioContext, tailWav);
  const convolution = useSampleData(audioContext, convolutionWav);

  React.useEffect(() => {
    if (convolution.data) {
      const convolver = audioContext.createConvolver();
      convolver.buffer = convolution.data;
      convolver.connect(audioContext.destination);
      const dryGainNode = audioContext.createGain();
      dryGainNode.gain.value = 0.8;
      dryGainNode.connect(audioContext.destination);
      const wetGainNode = audioContext.createGain();
      wetGainNode.gain.value = 0.2;
      wetGainNode.connect(convolver);
      setDestinationNodes([dryGainNode, wetGainNode]);
    }
  }, [audioContext, convolution.data]);

  if (!(head.data && loop.data && tail.data))
    return <div className="App">Loading samples...</div>;

  const p = {
    audioContext,
    destinationNodes,
    head: head.data,
    loop: loop.data,
    tail: tail.data,
  };

  return (
    <div className="App">
      hetkinen!!!
      <br />
      {[2, 1, 0, -1, -2].map((octave) => (
        <div key={octave}>
          {[0, 2, 4, 5, 7, 9, 11].map((tone) => (
            <NoteButton key={tone} octave={octave} tone={tone} {...p} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default App;
