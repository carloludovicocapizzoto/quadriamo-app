import { useAvatar } from '../../profile/avatar'
import { Icon } from '../Icon'

/** La foto profilo, oppure l'iniziale del nome (o la sagoma, senza account). Rotonda: è l'unica cosa davvero rotonda. */
export function Avatar({ name, size = 64 }: { name: string | null; size?: number }) {
  const src = useAvatar()
  return (
    <span className="me-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : name ? name.charAt(0).toUpperCase() : <Icon name="user" size={size * 0.44} />}
    </span>
  )
}
