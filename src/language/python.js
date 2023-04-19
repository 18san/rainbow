import numpy as np
import matplotlib.pyplot as plt
 
steps = np.array([(1,0), (0,-1), (-1,0),(0,1)]) # East, South, West, North
print(steps)
numSteps = 10000  #行走步数
locs      = np.zeros((numSteps,2))
for k in range(1,numSteps):
    step = steps[np.random.choice(np.arange(4))]
    locs[k]  = locs[k-1] + step
    
dist = np.sqrt(locs[:,0]**2 + locs[:,1]**2)            
dist_min = np.min(dist)
dist_max = np.max(dist)
origins = [] 
for k in range(numSteps):
    if locs[k,0]==0 and locs[k,1]==0:
        origins.append(k)
print('numSteps = {0}, final loc = {1}, dist = {2}, dist_min = {3}, dist_max = {4}'.format(numSteps,locs[-1],dist[-1], dist_min, dist_max))
print(origins)
 
plt.plot(locs[:,0],locs[:,1])
plt.title('random walks: {0} steps'.format(numSteps))
plt.show()
