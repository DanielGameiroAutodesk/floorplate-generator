import { useEffect, useState } from "preact/compat"
import styles from "./PopoutProperty.module.pcss"
import { useRef } from "preact/hooks"

export const PopoutProperty = ({
  title,
  summary,
  form,
  imgSrc,
}: {
  title: string
  summary: JSX.Element
  form: JSX.Element
  imgSrc: string
}) => {
  const [open, setOpen] = useState(false)

  const popout = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = popout.current
    const close = () => {
      console.log("closing")
      setOpen(false)
    }

    element?.addEventListener("weave-menu-container-close", close)
    return () => {
      element?.removeEventListener("weave-menu-container-close", close)
    }
  }, [popout])

  return (
    <>
      <div className={styles.popoutPropertyHolder}>
        <weave-menu-container ref={popout} title={title} right={10} top={0} open={open}>
          <section className={styles.form}>{form}</section>
        </weave-menu-container>
        <weave-tile variant="horizontal" height={80} selected={false} onClick={() => setOpen(true)}>
          <img src={imgSrc} slot="image" />
          <span slot="title" className={styles.title}>
            {title}
          </span>
          <span>{summary}</span>
        </weave-tile>
      </div>
    </>
  )
}
