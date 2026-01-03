import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import MobileStepper from '@mui/material/MobileStepper';
import Button from '@mui/material/Button';
import { Map, LogIn, ChevronRight } from 'lucide-react';

// Infrastructure images for the carousel
const images = [
  {
    label: 'Transparency in Action',
    description:
      'The E-BARMM system enables real-time tracking and monitoring of infrastructure projects across the Bangsamoro region, ensuring accountability and transparency in public works.',
    imgPath: 'https://images.pexels.com/photos/13423303/pexels-photo-13423303.jpeg',
  },
  {
    label: 'Road Infrastructure Progress',
    description:
      'From planning to completion, monitor the progress of road construction projects that connect communities and drive economic growth in the Bangsamoro Autonomous Region.',
    imgPath: 'https://images.pexels.com/photos/14406668/pexels-photo-14406668.jpeg',
  },
  {
    label: 'Connecting Communities',
    description:
      'Infrastructure development is key to building a prosperous Bangsamoro. Track projects that bring essential services closer to every barangay.',
    imgPath: 'https://images.pexels.com/photos/9881179/pexels-photo-9881179.jpeg',
  },
];

const maxSteps = images.length;

export default function Landing() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  // Auto-play carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prevActiveStep) => (prevActiveStep + 1) % maxSteps);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Carousel */}
      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
        <Card sx={{ position: 'relative', height: '100%', borderRadius: 0 }}>
          <CardMedia
            component="img"
            sx={{
              height: '100%',
              width: '100%',
              objectFit: 'cover',
              transition: 'opacity 0.5s ease-in-out',
            }}
            image={images[activeStep].imgPath}
            alt={images[activeStep].label}
          />

          {/* Dark overlay for better text readability */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.7) 100%)',
            }}
          />

          {/* Logo and Title at Top */}
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              left: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography
              variant="h5"
              sx={{
                color: 'white',
                fontWeight: 700,
                letterSpacing: 1,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              E-BARMM
            </Typography>
          </Box>

          {/* Login Button at Top Right */}
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              right: 24,
              display: 'flex',
              gap: 2,
              zIndex: 10,
            }}
          >
            <Button
              variant="outlined"
              startIcon={<Map size={18} />}
              onClick={() => navigate('/map')}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              View Map
            </Button>
            <Button
              variant="contained"
              startIcon={<LogIn size={18} />}
              onClick={() => navigate('/login')}
              sx={{
                backgroundColor: 'rgba(34, 139, 34, 0.9)',
                '&:hover': {
                  backgroundColor: 'rgba(34, 139, 34, 1)',
                },
              }}
            >
              Login
            </Button>
          </Box>

          {/* Content Overlay */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 100,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(34, 139, 34, 0.15)',
              color: 'white',
              p: { xs: 3, md: 5 },
              backdropFilter: 'blur(8px)',
              zIndex: 10,
            }}
          >
            <Box sx={{ maxWidth: 900 }}>
              <Typography
                variant="h3"
                component="div"
                sx={{
                  mb: 2,
                  fontWeight: 'bold',
                  fontSize: { xs: '1.75rem', md: '2.5rem' },
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {images[activeStep].label}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.8,
                  fontSize: { xs: '0.95rem', md: '1.1rem' },
                  maxWidth: 800,
                  opacity: 0.95,
                }}
              >
                {images[activeStep].description}
              </Typography>

              {/* CTA Buttons */}
              <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ChevronRight size={20} />}
                  onClick={() => navigate('/portal')}
                  sx={{
                    backgroundColor: 'white',
                    color: '#1a5f1a',
                    fontWeight: 600,
                    px: 4,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.9)',
                    },
                  }}
                >
                  View All Projects
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/map')}
                  sx={{
                    color: 'white',
                    borderColor: 'white',
                    fontWeight: 600,
                    px: 4,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderColor: 'white',
                    },
                  }}
                >
                  Explore Map
                </Button>
              </Box>
            </Box>
          </Box>
        </Card>

        {/* Navigation Dots */}
        <MobileStepper
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'transparent',
            '& .MuiMobileStepper-dot': {
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              width: 12,
              height: 12,
              mx: 0.5,
              transition: 'all 0.3s ease',
            },
            '& .MuiMobileStepper-dotActive': {
              backgroundColor: 'white',
              width: 24,
              borderRadius: 6,
            },
          }}
          nextButton={<Box />}
          backButton={<Box />}
        />

        {/* Manual Navigation - Click on sides */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '15%',
            cursor: 'pointer',
            '&:hover': {
              background: 'linear-gradient(to right, rgba(0,0,0,0.2), transparent)',
            },
          }}
          onClick={() => setActiveStep((prev) => (prev - 1 + maxSteps) % maxSteps)}
        />
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '15%',
            cursor: 'pointer',
            '&:hover': {
              background: 'linear-gradient(to left, rgba(0,0,0,0.2), transparent)',
            },
          }}
          onClick={() => setActiveStep((prev) => (prev + 1) % maxSteps)}
        />
      </Box>
    </Box>
  );
}
