import { useMemo } from "preact/hooks"
import styles from "./IconCarousel.module.pcss"
import Arrow_12 from "src/lib/components/icons/Arrow_12"
import { objectKeys } from "src/lib/record"

function SelectorCircle({
  selected,
  ...props
}: {
  selected: boolean
} & JSX.HTMLAttributes<SVGSVGElement>) {
  const className = selected ? styles.ActiveSelector : undefined
  return (
    <svg {...props} className={className} width="9" height="21" viewBox="0 0 9 21" xmlns="http://www.w3.org/2000/svg">
      <circle cx={4.5} cy={10.5} r={1.5} />
    </svg>
  )
}

export function IconCarousel<T extends string>({
  items,
  currentItem,
  onCurrentItemChanged,
  editAccess,
  ...props
}: {
  items: Record<T, JSX.Element>
  currentItem: T
  onCurrentItemChanged: (updatedCurrentItem: T) => void
  editAccess: boolean
} & JSX.HTMLAttributes<HTMLDivElement>) {
  const nextItem = useMemo(() => {
    const keys = objectKeys(items)
    return keys[(keys.indexOf(currentItem) + 1) % keys.length]
  }, [items, currentItem])
  const prevItem = useMemo(() => {
    const keys = objectKeys(items)
    return keys[(keys.indexOf(currentItem) - 1 + keys.length) % keys.length]
  }, [items, currentItem])
  return (
    <div
      {...props}
      className={styles.IconCarousel}
      onKeyDown={(event) => {
        if (event.key == "ArrowLeft") onCurrentItemChanged(prevItem)
        if (event.key == "ArrowRight") onCurrentItemChanged(nextItem)
      }}
    >
      <Arrow_12 className={styles.ArrowLeft} onClick={() => editAccess && onCurrentItemChanged(prevItem)} />
      <div className={styles.CarouselMain}>
        <div className={styles.Filler}></div>
        <div className={styles.IconWrapper}>{items[currentItem]}</div>
        <div className={styles.SelectorCircles}>
          {Object.entries(items).map(([item], index) => (
            <SelectorCircle
              key={index}
              selected={currentItem == item}
              onClick={() => editAccess && onCurrentItemChanged(item as T)}
            />
          ))}
        </div>
      </div>
      <Arrow_12 className={styles.ArrowRight} onClick={() => editAccess && onCurrentItemChanged(nextItem)} />
    </div>
  )
}
