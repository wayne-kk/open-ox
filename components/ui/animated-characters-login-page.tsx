"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import { SocialAuthSection } from "@/components/auth/social-auth-section";
import { AuthSessionRedirect } from "@/components/auth/auth-session-redirect";
import {
  loginWithEmail,
  registerWithEmail,
  requestPasswordResetEmail,
  resendVerificationEmail,
  updatePasswordFromRecovery,
  type EmailAuthErrorCode,
} from "@/lib/auth/email-auth";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import {
  readVerificationResendState,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  verificationResendSecondsRemaining,
  writeVerificationResendState,
} from "@/lib/auth/verification-resend-cooldown";

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY,
}: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  // Ref is read for layout-relative eye tracking; mouse position already triggers re-renders.
  // eslint-disable-next-line react-hooks/refs -- interactive pupil follows cursor vs element center
  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  // eslint-disable-next-line react-hooks/refs -- interactive pupil follows cursor vs element center
  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="flex items-center justify-center rounded-full transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
};

type AuthMode = "login" | "register" | "reset";

function modeFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): AuthMode {
  const raw = searchParams.get("mode");
  if (raw === "register" || raw === "reset") return raw;
  return "login";
}

function AuthPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(modeFromSearchParams(searchParams));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  const secretFieldFocused = isTyping;
  const anyPasswordVisible =
    mode === "login" ? showPassword : showPassword || showConfirmPassword;
  const redirect = safeRedirectTarget(searchParams.get("redirect") ?? "/dashboard");
  const compactAuth = mode === "register";

  useEffect(() => {
    setMode(modeFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const saved = readVerificationResendState(window.localStorage);
    if (!saved) return;
    setPendingVerificationEmail(saved.email);
    setResendAvailableAt(saved.resendAvailableAt);
    setCountdownNow(Date.now());
    setNotice(t("verificationEmailSent", { email: saved.email }));
  }, [t]);

  const resendSecondsRemaining = verificationResendSecondsRemaining(
    resendAvailableAt,
    countdownNow
  );

  useEffect(() => {
    if (!pendingVerificationEmail || resendSecondsRemaining === 0) return;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [pendingVerificationEmail, resendSecondsRemaining]);

  function startVerificationResendCooldown(targetEmail: string, seconds: number): void {
    const nextAvailableAt = Date.now() + seconds * 1_000;
    setPendingVerificationEmail(targetEmail);
    setResendAvailableAt(nextAvailableAt);
    setCountdownNow(Date.now());
    writeVerificationResendState(window.localStorage, {
      email: targetEmail,
      resendAvailableAt: nextAvailableAt,
    });
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPurpleBlinking(true);
        setTimeout(() => {
          setIsPurpleBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsBlackBlinking(true);
        setTimeout(() => {
          setIsBlackBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (secretFieldFocused) {
      setIsLookingAtEachOther(true);
      const timer = setTimeout(() => {
        setIsLookingAtEachOther(false);
      }, 800);
      return () => clearTimeout(timer);
    }
    setIsLookingAtEachOther(false);
  }, [secretFieldFocused]);

  useEffect(() => {
    if (password.length > 0 && anyPasswordVisible) {
      const schedulePeek = () => {
        const peekInterval = setTimeout(() => {
          setIsPurplePeeking(true);
          setTimeout(() => {
            setIsPurplePeeking(false);
          }, 800);
        }, Math.random() * 3000 + 2000);
        return peekInterval;
      };

      const firstPeek = schedulePeek();
      return () => clearTimeout(firstPeek);
    }
    setIsPurplePeeking(false);
  }, [password, anyPasswordVisible]);

  const calculatePosition = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));

    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));

    return { faceX, faceY, bodySkew };
  };

  /* eslint-disable react-hooks/refs -- character lean uses live layout vs cursor; mouse state drives re-render */
  const purplePos = calculatePosition(purpleRef);
  const blackPos = calculatePosition(blackRef);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);
  /* eslint-enable react-hooks/refs */

  const passwordHiddenLean = password.length > 0 && !anyPasswordVisible;

  function authErrorMessage(code: EmailAuthErrorCode): string {
    switch (code) {
      case "invalidEmail":
        return t("errorInvalidEmail");
      case "passwordShort":
        return t("errorPasswordShort");
      case "passwordMismatch":
        return t("errorPasswordMismatch");
      case "emailAlreadyRegistered":
        return t("errorEmailAlreadyRegistered");
      case "invalidCredentials":
        return t("errorInvalidCredentials");
      case "emailNotConfirmed":
        return t("errorEmailNotConfirmed");
      case "rateLimited":
        return t("errorRateLimited");
      case "config":
        return t("errorConfig");
      default:
        return t("errorUnknown");
    }
  }

  function clearFormFeedback() {
    setError("");
    setNotice("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFormFeedback();
    setPendingVerificationEmail("");
    setIsLoading(true);

    const result =
      mode === "register"
        ? await registerWithEmail({
            name,
            email,
            password,
            confirmPassword,
            next: redirect,
          })
        : mode === "reset"
          ? await updatePasswordFromRecovery({ password, confirmPassword })
          : await loginWithEmail({ email, password });

    if (!result.ok) {
      setError(authErrorMessage(result.code));
      if (result.code === "emailNotConfirmed") {
        setPendingVerificationEmail(email);
      }
      setIsLoading(false);
      return;
    }

    if ("email" in result) {
      startVerificationResendCooldown(result.email, VERIFICATION_RESEND_COOLDOWN_SECONDS);
      setNotice(t("verificationEmailSent", { email: result.email }));
      setPassword("");
      setConfirmPassword("");
      setIsLoading(false);
      return;
    }

    if (mode === "reset") {
      router.replace("/dashboard");
    } else {
      router.replace(redirect);
    }
    setIsLoading(false);
  };

  const handlePasswordResetRequest = async () => {
    clearFormFeedback();
    setPendingVerificationEmail("");
    setIsLoading(true);
    const result = await requestPasswordResetEmail({ email });
    if (!result.ok) {
      setError(authErrorMessage(result.code));
    } else {
      setNotice(t("passwordResetEmailSent"));
    }
    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    const targetEmail = pendingVerificationEmail || email;
    if (resendSecondsRemaining > 0) return;
    clearFormFeedback();
    setIsLoading(true);
    const result = await resendVerificationEmail({ email: targetEmail, next: redirect });
    if (!result.ok) {
      setError(authErrorMessage(result.code));
      if (result.retryAfterSec) {
        startVerificationResendCooldown(targetEmail, result.retryAfterSec);
      }
    } else if ("email" in result) {
      startVerificationResendCooldown(result.email, VERIFICATION_RESEND_COOLDOWN_SECONDS);
      setNotice(t("verificationEmailResent", { email: result.email }));
    } else {
      setNotice(t("verificationEmailResent", { email: targetEmail }));
    }
    setIsLoading(false);
  };

  const noticeTitle = pendingVerificationEmail ? t("verificationNoticeTitle") : t("noticeTitle");
  const noticeDescription = pendingVerificationEmail ? t("verificationNoticeDescription") : notice;
  const resendLabel =
    resendSecondsRemaining > 0
      ? t("resendVerificationCountdown", { seconds: resendSecondsRemaining })
      : t("resendVerification");

  return (
    <div className="relative h-dvh overflow-hidden">
      <AuthSessionRedirect />
      <div className="absolute left-4 top-4 z-50 lg:left-8 lg:top-8">
        <Button
          variant="ghost"
          className="h-10 gap-2 border border-primary-foreground/25 bg-primary-foreground px-4 font-mono text-[13px] font-medium tracking-wide text-primary shadow-[0_0_0_1px_rgba(10,10,15,0.08)] hover:bg-primary-foreground hover:text-primary/90 lg:hover:bg-white"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            {t("backHome")}
          </Link>
        </Button>
      </div>

      <div className="grid h-dvh overflow-hidden lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-center bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-12 pt-20 text-primary-foreground">
        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <div className="relative" style={{ width: "550px", height: "400px" }}>
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "70px",
                width: "180px",
                height:
                  secretFieldFocused || passwordHiddenLean ? "440px" : "400px",
                backgroundColor: "#6C3FF5",
                borderRadius: "10px 10px 0 0",
                zIndex: 1,
                transform:
                  password.length > 0 && anyPasswordVisible
                    ? `skewX(0deg)`
                    : secretFieldFocused || passwordHiddenLean
                      ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                      : `skewX(${purplePos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && anyPasswordVisible
                      ? `${20}px`
                      : isLookingAtEachOther
                        ? `${55}px`
                        : `${45 + purplePos.faceX}px`,
                  top:
                    password.length > 0 && anyPasswordVisible
                      ? `${35}px`
                      : isLookingAtEachOther
                        ? `${65}px`
                        : `${40 + purplePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && anyPasswordVisible
                      ? isPurplePeeking
                        ? 4
                        : -4
                      : isLookingAtEachOther
                        ? 3
                        : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible
                      ? isPurplePeeking
                        ? 5
                        : -4
                      : isLookingAtEachOther
                        ? 4
                        : undefined
                  }
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && anyPasswordVisible
                      ? isPurplePeeking
                        ? 4
                        : -4
                      : isLookingAtEachOther
                        ? 3
                        : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible
                      ? isPurplePeeking
                        ? 5
                        : -4
                      : isLookingAtEachOther
                        ? 4
                        : undefined
                  }
                />
              </div>
            </div>

            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "240px",
                width: "120px",
                height: "310px",
                backgroundColor: "#2D2D2D",
                borderRadius: "8px 8px 0 0",
                zIndex: 2,
                transform:
                  password.length > 0 && anyPasswordVisible
                    ? `skewX(0deg)`
                    : isLookingAtEachOther
                      ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                      : secretFieldFocused || passwordHiddenLean
                        ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                        : `skewX(${blackPos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && anyPasswordVisible
                      ? `${10}px`
                      : isLookingAtEachOther
                        ? `${32}px`
                        : `${26 + blackPos.faceX}px`,
                  top:
                    password.length > 0 && anyPasswordVisible
                      ? `${28}px`
                      : isLookingAtEachOther
                        ? `${12}px`
                        : `${32 + blackPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={
                    password.length > 0 && anyPasswordVisible
                      ? -4
                      : isLookingAtEachOther
                        ? 0
                        : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible
                      ? -4
                      : isLookingAtEachOther
                        ? -4
                        : undefined
                  }
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={
                    password.length > 0 && anyPasswordVisible
                      ? -4
                      : isLookingAtEachOther
                        ? 0
                        : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible
                      ? -4
                      : isLookingAtEachOther
                        ? -4
                        : undefined
                  }
                />
              </div>
            </div>

            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "0px",
                width: "240px",
                height: "200px",
                zIndex: 3,
                backgroundColor: "#FF9B6B",
                borderRadius: "120px 120px 0 0",
                transform:
                  password.length > 0 && anyPasswordVisible
                    ? `skewX(0deg)`
                    : `skewX(${orangePos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left:
                    password.length > 0 && anyPasswordVisible
                      ? `${50}px`
                      : `${82 + (orangePos.faceX || 0)}px`,
                  top:
                    password.length > 0 && anyPasswordVisible
                      ? `${85}px`
                      : `${90 + (orangePos.faceY || 0)}px`,
                }}
              >
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={
                    password.length > 0 && anyPasswordVisible ? -5 : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible ? -4 : undefined
                  }
                />
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={
                    password.length > 0 && anyPasswordVisible ? -5 : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible ? -4 : undefined
                  }
                />
              </div>
            </div>

            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "310px",
                width: "140px",
                height: "230px",
                backgroundColor: "#E8D754",
                borderRadius: "70px 70px 0 0",
                zIndex: 4,
                transform:
                  password.length > 0 && anyPasswordVisible
                    ? `skewX(0deg)`
                    : `skewX(${yellowPos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left:
                    password.length > 0 && anyPasswordVisible
                      ? `${20}px`
                      : `${52 + (yellowPos.faceX || 0)}px`,
                  top:
                    password.length > 0 && anyPasswordVisible
                      ? `${35}px`
                      : `${40 + (yellowPos.faceY || 0)}px`,
                }}
              >
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={
                    password.length > 0 && anyPasswordVisible ? -5 : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible ? -4 : undefined
                  }
                />
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={
                    password.length > 0 && anyPasswordVisible ? -5 : undefined
                  }
                  forceLookY={
                    password.length > 0 && anyPasswordVisible ? -4 : undefined
                  }
                />
              </div>
              <div
                className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
                style={{
                  left:
                    password.length > 0 && anyPasswordVisible
                      ? `${10}px`
                      : `${40 + (yellowPos.faceX || 0)}px`,
                  top:
                    password.length > 0 && anyPasswordVisible
                      ? `${88}px`
                      : `${88 + (yellowPos.faceY || 0)}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex h-dvh items-center justify-center overflow-hidden bg-background px-5 py-5 pt-16 sm:px-8 sm:py-6 sm:pt-16 lg:p-8">
        <div className="w-full max-w-[420px]">
          <div className={compactAuth ? "mb-5 text-center" : "text-center mb-10"}>
            <h1 className={compactAuth ? "mb-1.5 text-2xl font-bold tracking-tight" : "text-3xl font-bold tracking-tight mb-2"}>
              {mode === "login"
                ? t("welcomeTitle")
                : mode === "register"
                  ? t("registerTitle")
                  : t("resetTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "login"
                ? t("welcomeSubtitle")
                : mode === "register"
                  ? t("registerSubtitle")
                  : t("resetSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={compactAuth ? "space-y-3" : "space-y-5"}>
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  {t("name")}{" "}
                  <span className="text-muted-foreground font-normal">{t("nameOptional")}</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  className="h-11 bg-background border-border/60 focus-visible:border-primary"
                />
              </div>
            )}

            {mode !== "reset" && (
            <div className={compactAuth ? "space-y-1.5" : "space-y-2"}>
              <Label htmlFor="email" className="text-sm font-medium">
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className={compactAuth ? "h-11 bg-background border-border/60 focus-visible:border-primary" : "h-12 bg-background border-border/60 focus-visible:border-primary"}
              />
            </div>
            )}

            <div className={compactAuth ? "space-y-1.5" : "space-y-2"}>
              <Label htmlFor="password" className="text-sm font-medium">
                {t("password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={compactAuth ? "h-11 pr-10 bg-background border-border/60 focus-visible:border-primary" : "h-12 pr-10 bg-background border-border/60 focus-visible:border-primary"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            {mode !== "login" && (
              <div className={compactAuth ? "space-y-1.5" : "space-y-2"}>
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  {t("confirmPassword")}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    required
                    autoComplete="new-password"
                    className={compactAuth ? "h-11 pr-10 bg-background border-border/60 focus-visible:border-primary" : "h-12 pr-10 bg-background border-border/60 focus-visible:border-primary"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" className="border-white"/>
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    {t("remember")}
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePasswordResetRequest()}
                  disabled={isLoading}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {t("forgotPassword")}
                </button>
              </div>
            )}

            {mode === "register" && (
              <p className="text-[11px] leading-4 text-muted-foreground">
                {t("registerTerms")}
              </p>
            )}

            {error && (
              <div className="space-y-2 rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-sm text-red-400">
                <p>{error}</p>
                {pendingVerificationEmail ? (
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={isLoading || resendSecondsRemaining > 0}
                    className="font-medium text-red-100 hover:underline disabled:cursor-not-allowed disabled:text-red-200/55 disabled:no-underline"
                  >
                    {resendLabel}
                  </button>
                ) : null}
              </div>
            )}

            <Button
              type="submit"
              className={compactAuth ? "h-11 w-full text-base font-medium" : "w-full h-12 text-base font-medium"}
              size="lg"
              disabled={isLoading}
            >
              {isLoading
                ? mode === "login"
                  ? t("signingIn")
                  : mode === "register"
                    ? t("creatingAccount")
                    : t("resettingPassword")
                : mode === "login"
                  ? t("logIn")
                  : mode === "register"
                  ? t("signUp")
                  : t("resetPassword")}
            </Button>

            {notice && (
              <div
                aria-live="polite"
                className="flex animate-in fade-in-0 zoom-in-95 items-start gap-3 rounded-lg border border-border/70 bg-card/95 p-3 text-left shadow-lg shadow-black/20 ring-1 ring-foreground/5 backdrop-blur duration-200"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <MailCheck className="size-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5 text-card-foreground">
                        {noticeTitle}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {noticeDescription}
                      </p>
                      {pendingVerificationEmail ? (
                        <p className="mt-1 truncate text-xs font-medium leading-4 text-card-foreground/85">
                          {pendingVerificationEmail}
                        </p>
                      ) : null}
                    </div>
                    {pendingVerificationEmail ? (
                      <button
                        type="button"
                        onClick={() => void handleResendVerification()}
                        disabled={isLoading || resendSecondsRemaining > 0}
                        className="min-w-24 shrink-0 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
                      >
                        {resendLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </form>

          {mode !== "reset" && !notice && (
          <div className={compactAuth ? "relative mt-4" : "relative mt-6"}>
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-background px-2 text-muted-foreground">{t("or")}</span>
            </div>
          </div>
          )}

          {mode !== "reset" && !notice ? <SocialAuthSection compact={compactAuth} /> : null}

          <div className={compactAuth ? "mt-5 text-center text-sm text-muted-foreground" : "text-center text-sm text-muted-foreground mt-8"}>
            {mode === "login" ? (
              <>
                {t("noAccount")}{" "}
                <button
                  type="button"
                  className="text-foreground font-medium hover:underline"
                  onClick={() => {
                    setMode("register");
                    clearFormFeedback();
                    setPendingVerificationEmail("");
                  }}
                >
                  {t("signUp")}
                </button>
              </>
            ) : (
              <>
                {mode === "register" ? t("hasAccount") : t("rememberPassword")}{" "}
                <button
                  type="button"
                  className="text-foreground font-medium hover:underline"
                  onClick={() => {
                    setMode("login");
                    clearFormFeedback();
                    setPendingVerificationEmail("");
                    setConfirmPassword("");
                    setPassword("");
                  }}
                >
                  {t("logIn")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Alias for integrations that expect the original name */
export const LoginPage = AuthPage;

/** Default export for shadcn-style demos */
export const Component = AuthPage;
