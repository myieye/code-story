export function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [
    ['j / k', 'next / previous chunk'],
    ['n / Shift+N', 'next / previous unreviewed chunk'],
    ['Enter', 'mark reviewed, go to next unreviewed'],
    ['u', 'unmark'],
    ['x', 'collapse / expand chunk'],
    ['d', 'show / hide definitions for the chunk'],
    ['g', 'jump into the related-chunks strip (← / → between chips, Enter to follow)'],
    ['b', 'back to where you jumped from'],
    ['Ctrl+Home / Ctrl+End', 'top / end of book'],
    ['Esc', 'leave the editor, definitions, or the strip, back to the chunk'],
    ['?', 'this overlay'],
  ];
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <table>
          <tbody>
            {keys.map(([key, what]) => (
              <tr key={key}>
                <td className="key">{key}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="bar-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
