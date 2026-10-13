import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/lib/auth";
import { notificationPath, registerThisDevice, subscribeToInbox } from "@/lib/push";

let openedLastResponse = false;

export function PushBridge() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    void registerThisDevice();
    const stopInbox = subscribeToInbox(userId);
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      openNotification(event.notification.request.content.data);
    });

    if (!openedLastResponse) {
      openedLastResponse = true;
      void Notifications.getLastNotificationResponseAsync().then((event) => {
        if (!event) return;
        openNotification(event.notification.request.content.data);
        void Notifications.clearLastNotificationResponseAsync();
      });
    }

    return () => {
      stopInbox();
      response.remove();
    };
  }, [userId]);

  return null;
}

function openNotification(data: Record<string, unknown> | undefined) {
  const target = notificationPath(data);
  if (!target) return;
  if (target.kind === "event") {
    router.push({ pathname: "/event/[id]", params: { id: target.id } });
    return;
  }
  router.push("/notifications");
}
