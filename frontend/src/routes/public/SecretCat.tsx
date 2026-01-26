/**
 * SecretCat - Easter Egg Page
 *
 * A festive celebration page for those who found the hidden cat!
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { Cat, Sparkles, PartyPopper } from 'lucide-react';

// Meow sound synthesizer using Web Audio API
const createMeowSound = (audioContext: AudioContext) => {
  const now = audioContext.currentTime;
  const duration = 0.5 + Math.random() * 0.3;
  const baseFreq = 300 + Math.random() * 100;

  // Main oscillator (fundamental frequency)
  const osc1 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  osc1.type = 'sawtooth';
  osc1.connect(gain1);

  // Second oscillator (harmonic, slightly detuned for richness)
  const osc2 = audioContext.createOscillator();
  const gain2 = audioContext.createGain();
  osc2.type = 'triangle';
  osc2.connect(gain2);

  // Filter to shape the sound (cats have a nasal quality)
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.Q.setValueAtTime(2, now);

  // Connect through filter to destination
  gain1.connect(filter);
  gain2.connect(filter);
  filter.connect(audioContext.destination);

  // Meow pitch envelope: "me-OW" - rises then falls
  // Start low, rise to peak, then fall
  osc1.frequency.setValueAtTime(baseFreq * 0.8, now);
  osc1.frequency.linearRampToValueAtTime(baseFreq * 1.8, now + duration * 0.3);
  osc1.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + duration * 0.5);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + duration);

  // Second oscillator follows but higher (harmonic)
  osc2.frequency.setValueAtTime(baseFreq * 1.6, now);
  osc2.frequency.linearRampToValueAtTime(baseFreq * 3.2, now + duration * 0.3);
  osc2.frequency.linearRampToValueAtTime(baseFreq * 2.8, now + duration * 0.5);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, now + duration);

  // Filter sweep (opens up then closes)
  filter.frequency.setValueAtTime(600, now);
  filter.frequency.linearRampToValueAtTime(1500, now + duration * 0.3);
  filter.frequency.linearRampToValueAtTime(800, now + duration);

  // Volume envelope - quick attack, sustain, fade
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.15, now + 0.03);
  gain1.gain.linearRampToValueAtTime(0.12, now + duration * 0.4);
  gain1.gain.linearRampToValueAtTime(0.08, now + duration * 0.7);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.08, now + 0.03);
  gain2.gain.linearRampToValueAtTime(0.06, now + duration * 0.4);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Start and stop
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration + 0.1);
  osc2.stop(now + duration + 0.1);
};

// Firework particle type
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocityX: number;
  velocityY: number;
  life: number;
}

// Bouncing cat type
interface BouncingCat {
  id: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  emoji: string;
}

const CAT_EMOJIS = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐱', '🐈', '🐈‍⬛'];
const FIREWORK_COLORS = ['#ff0000', '#ff6600', '#ffff00', '#00ff00', '#00ffff', '#0066ff', '#9900ff', '#ff00ff', '#ff69b4', '#ffd700'];

const SecretCat: React.FC = () => {
  const navigate = useNavigate();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [cats, setCats] = useState<BouncingCat[]>([]);
  const [confetti, setConfetti] = useState<{ id: number; x: number; delay: number; color: string }[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context and play meow
  const playMeow = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      createMeowSound(audioContextRef.current);
    } catch {
      // Audio not supported, silently ignore
    }
  }, []);

  // Create a firework burst
  const createFirework = useCallback((x: number, y: number, withMeow = false) => {
    const newParticles: Particle[] = [];
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const particleCount = 30 + Math.floor(Math.random() * 20);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const velocity = 2 + Math.random() * 4;
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        color,
        size: 3 + Math.random() * 3,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        life: 1,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    // Play meow sound on user clicks
    if (withMeow) {
      playMeow();
    }
  }, [playMeow]);

  // Initialize bouncing cats
  useEffect(() => {
    const initialCats: BouncingCat[] = [];
    for (let i = 0; i < 15; i++) {
      initialCats.push({
        id: i,
        x: Math.random() * (window.innerWidth - 60),
        y: Math.random() * (window.innerHeight - 60),
        velocityX: (Math.random() - 0.5) * 6,
        velocityY: (Math.random() - 0.5) * 6,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: 30 + Math.random() * 40,
        emoji: CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)],
      });
    }
    setCats(initialCats);

    // Initialize confetti
    const initialConfetti = [];
    for (let i = 0; i < 50; i++) {
      initialConfetti.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 5,
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      });
    }
    setConfetti(initialConfetti);
  }, []);

  // Animate bouncing cats
  useEffect(() => {
    const interval = setInterval(() => {
      setCats(prevCats =>
        prevCats.map(cat => {
          let newX = cat.x + cat.velocityX;
          let newY = cat.y + cat.velocityY;
          let newVelocityX = cat.velocityX;
          let newVelocityY = cat.velocityY;

          // Bounce off walls
          if (newX <= 0 || newX >= window.innerWidth - cat.size) {
            newVelocityX = -newVelocityX;
            newX = Math.max(0, Math.min(window.innerWidth - cat.size, newX));
          }
          if (newY <= 0 || newY >= window.innerHeight - cat.size) {
            newVelocityY = -newVelocityY;
            newY = Math.max(0, Math.min(window.innerHeight - cat.size, newY));
          }

          return {
            ...cat,
            x: newX,
            y: newY,
            velocityX: newVelocityX,
            velocityY: newVelocityY,
            rotation: cat.rotation + cat.rotationSpeed,
          };
        })
      );
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // Animate particles (fireworks)
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prevParticles =>
        prevParticles
          .map(p => ({
            ...p,
            x: p.x + p.velocityX,
            y: p.y + p.velocityY,
            velocityY: p.velocityY + 0.1, // gravity
            life: p.life - 0.02,
          }))
          .filter(p => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // Auto-launch fireworks
  useEffect(() => {
    const launchFirework = () => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * (window.innerHeight * 0.6);
      createFirework(x, y);
    };

    // Initial burst
    for (let i = 0; i < 5; i++) {
      setTimeout(() => launchFirework(), i * 200);
    }

    // Continuous fireworks
    const interval = setInterval(launchFirework, 800);

    return () => clearInterval(interval);
  }, [createFirework]);

  // Random meows from bouncing cats
  useEffect(() => {
    // Play initial meow after a short delay (user interaction may be needed)
    const initialMeow = setTimeout(() => {
      playMeow();
    }, 500);

    // Random meows every 2-5 seconds
    const meowInterval = setInterval(() => {
      if (Math.random() > 0.5) {
        playMeow();
      }
    }, 2000 + Math.random() * 3000);

    return () => {
      clearTimeout(initialMeow);
      clearInterval(meowInterval);
    };
  }, [playMeow]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a0533 0%, #0d1b2a 50%, #1a0533 100%)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={(e) => createFirework(e.clientX, e.clientY, true)}
    >
      {/* Starfield background */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 20% 80%, rgba(255,215,0,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,105,180,0.1) 0%, transparent 50%)',
        }}
      />

      {/* Falling confetti */}
      {confetti.map(c => (
        <Box
          key={c.id}
          sx={{
            position: 'absolute',
            left: `${c.x}%`,
            top: '-20px',
            width: '10px',
            height: '10px',
            backgroundColor: c.color,
            borderRadius: '2px',
            animation: `confettiFall 5s linear ${c.delay}s infinite`,
            '@keyframes confettiFall': {
              '0%': {
                transform: 'translateY(-20px) rotate(0deg)',
                opacity: 1,
              },
              '100%': {
                transform: `translateY(${window.innerHeight + 40}px) rotate(720deg)`,
                opacity: 0.5,
              },
            },
          }}
        />
      ))}

      {/* Bouncing cats */}
      {cats.map(cat => (
        <Box
          key={cat.id}
          sx={{
            position: 'absolute',
            left: cat.x,
            top: cat.y,
            fontSize: cat.size,
            transform: `rotate(${cat.rotation}deg)`,
            transition: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))',
            zIndex: 10,
          }}
        >
          {cat.emoji}
        </Box>
      ))}

      {/* Firework particles */}
      {particles.map(particle => (
        <Box
          key={particle.id}
          sx={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: '50%',
            opacity: particle.life,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            zIndex: 5,
          }}
        />
      ))}

      {/* Main content */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 100,
          padding: 4,
          borderRadius: 4,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255,215,0,0.5)',
          boxShadow: '0 0 40px rgba(255,215,0,0.3)',
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': {
              boxShadow: '0 0 40px rgba(255,215,0,0.3)',
            },
            '50%': {
              boxShadow: '0 0 60px rgba(255,215,0,0.6)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
          <PartyPopper size={40} color="#ffd700" />
          <Sparkles size={40} color="#ff69b4" />
          <Cat size={40} color="#fff" />
          <Sparkles size={40} color="#ff69b4" />
          <PartyPopper size={40} color="#ffd700" />
        </Box>

        <Typography
          variant="h2"
          sx={{
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #9b59b6)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'rainbow 3s ease infinite',
            '@keyframes rainbow': {
              '0%': { backgroundPosition: '0% 50%' },
              '50%': { backgroundPosition: '100% 50%' },
              '100%': { backgroundPosition: '0% 50%' },
            },
            mb: 2,
            textShadow: '0 0 20px rgba(255,255,255,0.3)',
          }}
        >
          CONGRATULATIONS!
        </Typography>

        <Typography
          variant="h4"
          sx={{
            color: '#fff',
            mb: 1,
            textShadow: '0 0 10px rgba(255,255,255,0.5)',
          }}
        >
          You Found the Secret Cat!
        </Typography>

        <Box
          sx={{
            fontSize: '80px',
            my: 3,
            animation: 'bounce 1s ease infinite',
            '@keyframes bounce': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-20px)' },
            },
          }}
        >
          🎉🐱🎉
        </Box>

        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255,255,255,0.8)',
            mb: 3,
            maxWidth: 400,
          }}
        >
          You have excellent observation skills! As a reward, enjoy this festive celebration.
          Click anywhere to launch more fireworks!
        </Typography>

        <Button
          variant="contained"
          onClick={() => navigate(-1)}
          sx={{
            background: 'linear-gradient(45deg, #ff6b6b, #ffd93d)',
            color: '#000',
            fontWeight: 'bold',
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
            '&:hover': {
              background: 'linear-gradient(45deg, #ffd93d, #ff6b6b)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
          }}
        >
          Back to Map
        </Button>
      </Box>

      {/* Corner decorations */}
      <Typography
        sx={{
          position: 'absolute',
          top: 20,
          left: 20,
          fontSize: '40px',
          animation: 'spin 4s linear infinite',
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
        }}
      >
        ✨
      </Typography>
      <Typography
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          fontSize: '40px',
          animation: 'spin 4s linear infinite reverse',
        }}
      >
        ✨
      </Typography>
      <Typography
        sx={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          fontSize: '40px',
          animation: 'spin 3s linear infinite',
        }}
      >
        🎊
      </Typography>
      <Typography
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          fontSize: '40px',
          animation: 'spin 3s linear infinite reverse',
        }}
      >
        🎊
      </Typography>
    </Box>
  );
};

export default SecretCat;
