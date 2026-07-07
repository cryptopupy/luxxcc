import { CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastLabel,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, icon, label, link, ...props }) {
        const Icon = icon || (variant === "destructive" ? XCircle : CheckCircle2);
        return (
          <Toast key={id} variant={variant} {...props}>
            <ToastIcon>
              <Icon className="h-[18px] w-[18px]" />
            </ToastIcon>
            <div className="grid flex-1 gap-1">
              <ToastLabel>{label || (variant === "destructive" ? "Error" : "Notice")}</ToastLabel>
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {link && (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[#8ea1ff] hover:underline"
                >
                  {link.label || link.href}
                </a>
              )}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 