import type { UserWithConnectionId } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/websocketBusinessLogic"

interface UserlistProps {
  users: UserWithConnectionId[]
}

const nameOrEmail = (user: UserWithConnectionId) => {
  const name = `${user.given_name || ""} ${user.family_name || ""}`.trim()
  return name || user.email
}

const Userlist = ({ users }: UserlistProps) => {
  return (
    <div slot="avatars">
      <weave-avatarbundle size="small">
        {users.map((user) => (
          <weave-avatar
            key={user.connectionId}
            size="small"
            name={user.given_name || ""}
            image={user.picture}
            alt={user.email}
            label={user.given_name || ""}
            tooltip={nameOrEmail(user)}
          />
        ))}
      </weave-avatarbundle>
    </div>
  )
}

export default Userlist
