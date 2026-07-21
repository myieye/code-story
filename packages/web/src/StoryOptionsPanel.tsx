import { explainStoryOptions, type StoryConfig } from '@code-story/core';

/**
 * "How this story was generated" (R-062): the exact options this story used, each with a plain-language
 * meaning and whether changing it costs a paid AI re-run (💸) or is free. The copy is owned by core's
 * explainStoryOptions so it can't drift from the library's chips.
 */
export function StoryOptionsPanel({
  config,
  mode,
  aiOrder,
  models,
}: {
  config: StoryConfig;
  mode: 'file' | 'chapter';
  aiOrder: boolean;
  models?: { order?: string; narration?: string };
}) {
  const options = explainStoryOptions({ config, mode, aiOrder, models });
  return (
    <dl className="story-options-panel">
      {options.map((o) => (
        <div key={o.key} className="story-option">
          <dt>
            {o.label}
            <span
              className={`cost-badge cost-${o.cost}`}
              title={o.cost === 'regenerates' ? 'Changing this needs a paid AI re-run' : 'Free to change'}
            >
              {o.cost === 'regenerates' ? '💸 regenerates' : 'free'}
            </span>
          </dt>
          <dd>
            <span className="option-value">{o.value}</span>
            <span className="option-meaning" title={o.costNote}>
              {o.meaning}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
