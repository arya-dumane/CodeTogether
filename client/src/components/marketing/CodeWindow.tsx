const comment = 'text-[#6F8A7C]';
const keyword = 'text-[#E7A17A]';
const fn = 'text-[#9CC7B6]';
const plain = 'text-[#D8E3DC]';

function CursorLabel({ name, tone }: { name: string; tone: 'accent' | 'primary' }) {
  const toneClass = tone === 'accent' ? 'bg-accent text-white' : 'bg-[#3C8D74] text-white';

  return (
    <span className="relative ml-1 inline-flex align-middle">
      <span className="h-4 w-px bg-current opacity-80" aria-hidden="true" />
      <span className={`ml-0.5 rounded-sm px-1 py-0.5 text-[10px] font-medium leading-none ${toneClass}`}>
        {name}
      </span>
    </span>
  );
}

export function CodeWindow() {
  return (
    <figure className="relative">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-code shadow-xl shadow-ink/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#9DB3A7]">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span>two-sum.ts</span>
          </div>
          <span className="truncate font-mono text-[11px] text-[#7E958A]">practice-room</span>
        </div>

        <div className="px-4 py-4 font-mono text-[12px] leading-6 sm:text-[13px]">
          <pre className="overflow-x-auto">
            <code>
              <span className={comment}>// Room: two-sum-practice</span>
              {'\n'}
              <span className={keyword}>function</span> <span className={fn}>twoSum</span>
              <span className={plain}>(nums: number[], target: number) {'{'}</span>
              {'\n'}
              <span className={plain}>  </span>
              <span className={keyword}>const</span> <span className={plain}>seen = </span>
              <span className={keyword}>new</span> <span className={fn}>Map</span>
              <span className={plain}>&lt;number, number&gt;();</span>
              {'\n'}
              <span className={plain}>  </span>
              <span className={keyword}>for</span> <span className={plain}>(</span>
              <span className={keyword}>let</span> <span className={plain}>i = 0; i &lt; nums.length; i++) {'{'}</span>
              {'\n'}
              <span className={plain}>    </span>
              <span className={keyword}>const</span> <span className={plain}>need = target - nums[i];</span>
              <span className={plain}> </span>
              <CursorLabel name="Maya" tone="accent" />
              {'\n'}
              <span className={plain}>    </span>
              <span className={keyword}>if</span> <span className={plain}>(seen.</span>
              <span className={fn}>has</span>
              <span className={plain}>(need)) </span>
              <span className={keyword}>return</span> <span className={plain}>[seen.</span>
              <span className={fn}>get</span>
              <span className={plain}>(need)!, i];</span>
              {'\n'}
              <span className={plain}>    seen.</span>
              <span className={fn}>set</span>
              <span className={plain}>(nums[i], i);</span>
              <span className={plain}> </span>
              <CursorLabel name="You" tone="primary" />
              {'\n'}
              <span className={plain}>  {'}'}</span>
              {'\n'}
              <span className={plain}>{'}'}</span>
              {'\n\n'}
              <span className={comment}>// Two learners, one buffer.</span>
            </code>
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-code bg-accent text-[10px] font-semibold text-white">
                M
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-full border border-code bg-[#3C8D74] text-[10px] font-semibold text-white">
                Y
              </span>
            </div>
            <span className="text-[11px] text-[#9DB3A7]">2 editing</span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#9DB3A7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7FBF9E]" aria-hidden="true" />
            connected
          </span>
        </div>
      </div>
      <figcaption className="sr-only">
        Illustrative preview of two people editing the same TypeScript file in a shared room.
      </figcaption>
    </figure>
  );
}
