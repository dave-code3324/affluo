type AuthNoticeProps = {
  error?: string | string[];
  message?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function AuthNotice({ error, message }: AuthNoticeProps) {
  const errorText = firstValue(error);
  const messageText = firstValue(message);

  if (!errorText && !messageText) {
    return null;
  }

  return (
    <p
      role={errorText ? "alert" : "status"}
      className={
        errorText
          ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      }
    >
      {errorText ?? messageText}
    </p>
  );
}
