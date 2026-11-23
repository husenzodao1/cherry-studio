/**
 * A plan's crown: a real 3D crown (rendered, tools/render-assets jobs-crowns.json) turning slowly in its own
 * light — Premium's in gold with rubies and amethysts, Standard's in platinum with sapphires — floating a
 * little, with a soft glow under it and sparkles twinkling round it. No box around it.
 */
export function CrownSpin({ plan, size = 120, still = false }: { plan: 'standard' | 'premium'; size?: number; still?: boolean }) {
  return (
    <span className={`crown-spin is-${plan}${still ? ' is-still' : ''}`} style={{ ['--s' as string]: `${size}px` }} aria-hidden="true">
      <span className="crown-glow" />
      <i className="crown-frames" />
      {still ? null : <><b className="crown-spark s1" /><b className="crown-spark s2" /><b className="crown-spark s3" /><b className="crown-spark s4" /></>}
    </span>
  )
}
