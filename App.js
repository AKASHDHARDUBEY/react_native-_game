import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from "react-native";
import { Accelerometer } from "expo-sensors";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;

const BULLET_WIDTH = 10;
const BULLET_HEIGHT = 20;

const BLOCK_WIDTH = 40;
const BLOCK_HEIGHT = 40;

function isColliding(a, b, aWidth = BULLET_WIDTH, aHeight = BULLET_HEIGHT, bWidth = BLOCK_WIDTH, bHeight = BLOCK_HEIGHT) {
  return (
    a.x < b.x + bWidth &&
    a.x + aWidth > b.x &&
    a.y < b.y + bHeight &&
    a.y + aHeight > b.y
  );
}

export default function App() {
  const [playerX, setPlayerX] = useState((screenWidth - PLAYER_WIDTH) / 2);
  const [bullets, setBullets] = useState([]);
  const [fallingBlocks, setFallingBlocks] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [levelTransition, setLevelTransition] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const bulletsRef = useRef([]);

  useEffect(() => {
    if (!gameStarted || gameOver || levelTransition) return;

    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x }) => {
      const move = x * 30;
      setPlayerX((prevX) => {
        const nextX = prevX + move;
        return Math.max(0, Math.min(screenWidth - PLAYER_WIDTH, nextX));
      });
    });

    return () => subscription.remove();
  }, [gameStarted, gameOver, levelTransition]);

  useEffect(() => {
    if (!gameStarted || gameOver || levelTransition) return;

    let interval = setInterval(() => {
      setBullets((prevBullets) =>
        prevBullets
          .map((b) => ({ ...b, y: b.y - 15 }))
          .filter((b) => b.y + 20 > 0)
      );
    }, 50);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver, levelTransition]);

  useEffect(() => {
    if (!gameStarted || gameOver || levelTransition) return;

    // Level 1: spawn every 2000ms, Level 2: spawn every 1200ms
    const spawnInterval = level === 1 ? 2000 : 1200;

    const interval = setInterval(() => {
      const block = {
        id: Date.now(),
        x: Math.random() * (screenWidth - PLAYER_WIDTH),
        y: -50,
      };

      setFallingBlocks((prev) => [...prev, block]);
    }, spawnInterval);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver, level, levelTransition]);

  // Keep bullets ref in sync
  useEffect(() => {
    bulletsRef.current = bullets;
  }, [bullets]);

  // Handle level transition countdown
  useEffect(() => {
    if (!levelTransition) {
      setCountdown(10);
      return;
    }

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          // Level transition complete - start level 2
          setLevel(2);
          setLevelTransition(false);
          // Clear all blocks and bullets for new level
          setFallingBlocks([]);
          setBullets([]);
          return 10;
        }
        return newCount;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [levelTransition]);

  useEffect(() => {
    if (!gameStarted || gameOver || levelTransition) return;

    // Level 1: fall speed 3, Level 2: fall speed 6
    const fallSpeed = level === 1 ? 3 : 6;

    const interval = setInterval(() => {
      setFallingBlocks((prevBlocks) => {
        const currentBullets = bulletsRef.current;
        const hitBlockIds = new Set();
        let blocksHit = 0;

        // Check all bullet-block collisions
        currentBullets.forEach((bullet) => {
          prevBlocks.forEach((block) => {
            if (!hitBlockIds.has(block.id) && isColliding(bullet, block)) {
              hitBlockIds.add(block.id);
              blocksHit++;
            }
          });
        });

        // Update score and bullets if collisions occurred
        if (blocksHit > 0) {
          setScore((prevScore) => {
            const newTotalScore = prevScore + (blocksHit * 10);
            // Level up at score 50
            if (newTotalScore >= 50 && level === 1 && !levelTransition) {
              setLevelTransition(true);
              setCountdown(10);
            }
            return newTotalScore;
          });

          setBullets((prevBullets) => {
            return prevBullets.filter((bullet) => {
              return !prevBlocks.some((block) => 
                hitBlockIds.has(block.id) && isColliding(bullet, block)
              );
            });
          });
        }

        // Move blocks down
        const movedBlocks = prevBlocks.map((b) => ({ ...b, y: b.y + fallSpeed }));

        // Check for game over - if any block reached bottom without being destroyed
        // Player is positioned at bottom: 20px from bottom
        // Player top Y position = screenHeight - 20 - PLAYER_HEIGHT
        const playerTopY = screenHeight - 20 - PLAYER_HEIGHT;
        let shouldGameOver = false;
        
        // Check each block to see if it reached the bottom
        movedBlocks.forEach((block) => {
          // Only check blocks that weren't destroyed by bullets
          if (!hitBlockIds.has(block.id)) {
            // Check if block's bottom edge has reached or passed the player area
            const blockBottom = block.y + BLOCK_HEIGHT;
            
            // Game over if block reaches the player area (bottom of screen)
            if (blockBottom >= playerTopY) {
              shouldGameOver = true;
            }
          }
        });

        // Trigger game over if any block reached bottom
        if (shouldGameOver) {
          setGameOver(true);
        }

        // Filter blocks
        return movedBlocks.filter((block) => {
          // Remove blocks that were hit by bullets
          if (hitBlockIds.has(block.id)) {
            return false;
          }

          // Remove blocks that reached bottom (game over already triggered)
          const blockBottom = block.y + BLOCK_HEIGHT;
          if (blockBottom >= playerTopY) {
            return false;
          }

          // Keep blocks that are still on screen
          return block.y < screenHeight + 50;
        });
      });
    }, 50);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver, level, levelTransition]);

  const handleBullets = () => {
    if (!gameStarted || gameOver || levelTransition) return;
    
    const newBullet = {
      id: Date.now(),
      x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH,
      y: screenHeight - PLAYER_HEIGHT - BULLET_HEIGHT * 2,
    };
    setBullets((prev) => [...prev, newBullet]);
  };

  const resetGame = () => {
    setPlayerX((screenWidth - PLAYER_WIDTH) / 2);
    setBullets([]);
    setFallingBlocks([]);
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setLevelTransition(false);
    setCountdown(10);
    setGameStarted(true);
  };

  if (!gameStarted) {
    return (
      <View style={styles.container}>
        <Text style={styles.titleText}>Tilt Fire Game</Text>
        <TouchableOpacity style={styles.startButton} onPress={resetGame}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (levelTransition) {
    return (
      <View style={styles.container}>
        <Text style={styles.levelUpText}>Level Up!</Text>
        <Text style={styles.countdownText}>Starting Level {level + 1} in {countdown}</Text>
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={styles.container}>
        <Text style={styles.gameOverText}>Game Over</Text>
        <Text style={styles.finalScoreText}>Final Score: {score}</Text>
        <TouchableOpacity style={styles.startButton} onPress={resetGame}>
          <Text style={styles.startButtonText}>Restart</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleBullets}>
      <View style={styles.container}>
        {fallingBlocks.map((block) => (
          <View
            key={block.id}
            style={[
              styles.fallingBlock,
              {
                top: block.y,
                left: block.x,
              },
            ]}
          />
        ))}
        {bullets.map((b) => (
          <View
            key={b.id}
            style={[
              styles.bullet,
              {
                left: b.x,
                top: b.y,
              },
            ]}
          />
        ))}
        <View style={[styles.player, { left: playerX }]} />
        <Text style={styles.instruction}>Tilt your phone to move</Text>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.levelText}>Level: {level}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFACD",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 60,
  },
  player: {
    position: "absolute",
    bottom: 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#000",
  },
  instruction: {
    position: "absolute",
    top: 70,
    color: "#333",
    fontFamily: "Courier",
    fontSize: 14,
  },
  bullet: {
    position: "absolute",
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#000",
  },
  fallingBlock: {
    position: "absolute",
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "black",
  },
  gameOverText: {
    position: "absolute",
    top: screenHeight / 2 - 80,
    color: "#333",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  finalScoreText: {
    position: "absolute",
    top: screenHeight / 2 - 20,
    color: "#333",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  scoreText: {
    position: "absolute",
    top: 40,
    right: 20,
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  levelText: {
    position: "absolute",
    top: 70,
    right: 20,
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  titleText: {
    position: "absolute",
    top: screenHeight / 2 - 100,
    color: "#333",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  startButton: {
    position: "absolute",
    top: screenHeight / 2 + 20,
    backgroundColor: "#FFF",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#000",
  },
  startButtonText: {
    color: "#000",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  levelUpText: {
    position: "absolute",
    top: screenHeight / 2 - 80,
    color: "#333",
    fontSize: 36,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  countdownText: {
    position: "absolute",
    top: screenHeight / 2 - 20,
    color: "#333",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
});
