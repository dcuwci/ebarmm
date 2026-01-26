/**
 * SecretCat - Easter Egg Page
 *
 * A festive celebration page for those who found the hidden cat!
 */

import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { Cat, Sparkles, PartyPopper } from 'lucide-react';

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

  // Create a firework burst
  const createFirework = useCallback((x: number, y: number) => {
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
  }, []);

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
      onClick={(e) => createFirework(e.clientX, e.clientY)}
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
