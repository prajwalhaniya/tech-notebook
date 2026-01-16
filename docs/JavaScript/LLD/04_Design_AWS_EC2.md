---
sidebar_position: 4
---

# Design AWS EC2 Service

## Table of Contents
1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Class Design](#class-design)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Key Algorithms](#key-algorithms)
7. [Design Patterns](#design-patterns)
8. [Error Handling](#error-handling)
9. [Performance Optimizations](#performance-optimizations)

## Overview

This document provides the Low-Level Design (LLD) for an AWS EC2-like cloud compute service, focusing on detailed class structures, data models, and implementation details for core features including instance management, storage, networking, security groups, and orchestration.

## System Requirements

### Functional Requirements
- Launch, start, stop, restart, and terminate instances
- Manage instance types and configurations
- Support multiple operating system images (AMIs)
- Attach/detach persistent storage volumes
- Configure networking (VPC, subnets, security groups)
- Monitor instance metrics and health
- Handle instance lifecycle state transitions
- Resource scheduling and placement
- Billing and usage tracking

### Non-Functional Requirements
- High availability (99.99% uptime SLA)
- Low latency (< 60s instance launch, < 100ms API latency)
- Scalability (millions of instances, billions of API calls/day)
- High throughput (millions of API calls per second)
- Data durability (11 nines for storage)
- Network isolation between customers
- Encryption at rest and in transit

## Class Design

### Core Domain Classes

#### Instance
```javascript
class Instance {
  constructor(instanceId, accountId, imageId, instanceType) {
    this.instanceId = instanceId;
    this.accountId = accountId;
    this.imageId = imageId;
    this.instanceType = instanceType;
    this.state = InstanceState.PENDING;
    this.availabilityZone = null;
    this.subnetId = null;
    this.vpcId = null;
    this.privateIpAddress = null;
    this.publicIpAddress = null;
    this.elasticIpAddress = null;
    this.keyName = null;
    this.launchTime = null;
    this.terminationTime = null;
    this.userData = null;
    this.securityGroupIds = [];
    this.tags = new Map();
    this.volumes = [];
    this.hypervisorHostId = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  transitionTo(newState) {
    if (!this.state.canTransitionTo(newState)) {
      throw new Error(
        `Invalid state transition from ${this.state.value} to ${newState.value}`
      );
    }
    this.state = newState;
    this.updatedAt = new Date();
  }

  start() {
    if (this.state.value === InstanceState.STOPPED.value) {
      this.transitionTo(InstanceState.PENDING);
    } else {
      throw new Error(`Cannot start instance in state: ${this.state.value}`);
    }
  }

  stop() {
    if (this.state.value === InstanceState.RUNNING.value) {
      this.transitionTo(InstanceState.STOPPING);
    } else {
      throw new Error(`Cannot stop instance in state: ${this.state.value}`);
    }
  }

  terminate() {
    if ([InstanceState.RUNNING, InstanceState.STOPPED].includes(this.state.value)) {
      this.transitionTo(InstanceState.SHUTTING_DOWN);
      this.terminationTime = new Date();
    } else {
      throw new Error(`Cannot terminate instance in state: ${this.state.value}`);
    }
  }

  attachVolume(volumeId, device) {
    if (this.state.value !== InstanceState.RUNNING.value) {
      throw new Error('Instance must be running to attach volume');
    }
    this.volumes.push({ volumeId, device, attachedAt: new Date() });
  }

  detachVolume(volumeId) {
    this.volumes = this.volumes.filter(v => v.volumeId !== volumeId);
  }

  addSecurityGroup(securityGroupId) {
    if (!this.securityGroupIds.includes(securityGroupId)) {
      this.securityGroupIds.push(securityGroupId);
    }
  }

  removeSecurityGroup(securityGroupId) {
    this.securityGroupIds = this.securityGroupIds.filter(
      id => id !== securityGroupId
    );
  }

  addTag(key, value) {
    this.tags.set(key, value);
  }

  removeTag(key) {
    this.tags.delete(key);
  }

  isRunning() {
    return this.state.value === InstanceState.RUNNING.value;
  }

  isTerminated() {
    return this.state.value === InstanceState.TERMINATED.value;
  }
}
```

#### InstanceState (State Pattern)
```javascript
class InstanceState {
  constructor(value, allowedTransitions = []) {
    this.value = value;
    this.allowedTransitions = allowedTransitions;
  }

  canTransitionTo(newState) {
    return this.allowedTransitions.includes(newState.value);
  }

  static PENDING = new InstanceState('pending', ['running', 'terminated']);
  static RUNNING = new InstanceState('running', ['stopping', 'shutting-down']);
  static STOPPING = new InstanceState('stopping', ['stopped']);
  static STOPPED = new InstanceState('stopped', ['pending', 'shutting-down']);
  static SHUTTING_DOWN = new InstanceState('shutting-down', ['terminated']);
  static TERMINATED = new InstanceState('terminated', []);
}
```

#### InstanceType
```javascript
class InstanceType {
  constructor(
    name,
    vcpu,
    memoryGB,
    networkPerformance,
    ebsBandwidthMbps,
    instanceStoreGB = 0
  ) {
    this.name = name;
    this.vcpu = vcpu;
    this.memoryGB = memoryGB;
    this.networkPerformance = networkPerformance;
    this.ebsBandwidthMbps = ebsBandwidthMbps;
    this.instanceStoreGB = instanceStoreGB;
    this.family = this.determineFamily(name);
  }

  determineFamily(name) {
    if (name.startsWith('t')) return 'general-purpose';
    if (name.startsWith('c')) return 'compute-optimized';
    if (name.startsWith('m')) return 'general-purpose';
    if (name.startsWith('r')) return 'memory-optimized';
    if (name.startsWith('i')) return 'storage-optimized';
    if (name.startsWith('g')) return 'gpu';
    return 'general-purpose';
  }

  getResourceRequirements() {
    return {
      cpu: this.vcpu,
      memory: this.memoryGB * 1024, // Convert to MB
      network: this.networkPerformance,
      storage: this.instanceStoreGB
    };
  }

  static T3_MICRO = new InstanceType('t3.micro', 2, 1, 'Up to 5 Gigabit', 1920);
  static T3_SMALL = new InstanceType('t3.small', 2, 2, 'Up to 5 Gigabit', 1920);
  static T3_MEDIUM = new InstanceType('t3.medium', 2, 4, 'Up to 5 Gigabit', 1920);
  static T3_LARGE = new InstanceType('t3.large', 2, 8, 'Up to 5 Gigabit', 1920);
  static C5_LARGE = new InstanceType('c5.large', 2, 4, 'Up to 10 Gigabit', 4750);
  static M5_LARGE = new InstanceType('m5.large', 2, 8, 'Up to 10 Gigabit', 4750);
}
```

#### Image (AMI)
```javascript
class Image {
  constructor(imageId, accountId, name) {
    this.imageId = imageId;
    this.accountId = accountId;
    this.name = name;
    this.description = null;
    this.state = ImageState.PENDING;
    this.architecture = 'x86_64';
    this.platform = 'Linux';
    this.rootDeviceType = 'ebs';
    this.rootDeviceName = '/dev/sda1';
    this.creationDate = new Date();
    this.isPublic = false;
    this.blockDeviceMappings = [];
    this.location = null; // S3 location
  }

  markAsAvailable() {
    this.state = ImageState.AVAILABLE;
  }

  deregister() {
    this.state = ImageState.DEREGISTERED;
  }

  makePublic() {
    this.isPublic = true;
  }

  makePrivate() {
    this.isPublic = false;
  }

  addBlockDeviceMapping(deviceName, ebsConfig) {
    this.blockDeviceMappings.push({
      deviceName,
      ebs: ebsConfig
    });
  }

  isAvailable() {
    return this.state === ImageState.AVAILABLE;
  }
}

class ImageState {
  static PENDING = 'pending';
  static AVAILABLE = 'available';
  static DEREGISTERED = 'deregistered';
  static FAILED = 'failed';
}
```

#### Volume
```javascript
class Volume {
  constructor(volumeId, accountId, availabilityZone, volumeType, size) {
    this.volumeId = volumeId;
    this.accountId = accountId;
    this.availabilityZone = availabilityZone;
    this.volumeType = volumeType;
    this.size = size; // in GB
    this.state = VolumeState.CREATING;
    this.encrypted = false;
    this.kmsKeyId = null;
    this.iops = this.calculateIOPS();
    this.throughput = this.calculateThroughput();
    this.attachedTo = null; // instanceId
    this.device = null;
    this.createdAt = new Date();
    this.snapshots = [];
  }

  calculateIOPS() {
    const iopsMap = {
      'gp3': Math.max(3000, this.size * 3),
      'gp2': Math.min(16000, this.size * 3),
      'io1': 100,
      'io2': 100,
      'st1': 500,
      'sc1': 250
    };
    return iopsMap[this.volumeType] || 3000;
  }

  calculateThroughput() {
    const throughputMap = {
      'gp3': Math.max(125, this.size * 0.125),
      'gp2': 250,
      'io1': 1000,
      'io2': 1000,
      'st1': 500,
      'sc1': 250
    };
    return throughputMap[this.volumeType] || 125;
  }

  markAsAvailable() {
    this.state = VolumeState.AVAILABLE;
  }

  attach(instanceId, device) {
    if (this.state !== VolumeState.AVAILABLE) {
      throw new Error(`Cannot attach volume in state: ${this.state}`);
    }
    this.state = VolumeState.ATTACHING;
    this.attachedTo = instanceId;
    this.device = device;
  }

  markAsAttached() {
    this.state = VolumeState.IN_USE;
  }

  detach() {
    if (this.state !== VolumeState.IN_USE) {
      throw new Error(`Cannot detach volume in state: ${this.state}`);
    }
    this.state = VolumeState.AVAILABLE;
    this.attachedTo = null;
    this.device = null;
  }

  delete() {
    if (this.state === VolumeState.IN_USE) {
      throw new Error('Cannot delete attached volume');
    }
    this.state = VolumeState.DELETING;
  }

  isAvailable() {
    return this.state === VolumeState.AVAILABLE;
  }

  isAttached() {
    return this.state === VolumeState.IN_USE;
  }
}

class VolumeState {
  static CREATING = 'creating';
  static AVAILABLE = 'available';
  static ATTACHING = 'attaching';
  static IN_USE = 'in-use';
  static DETACHING = 'detaching';
  static DELETING = 'deleting';
  static DELETED = 'deleted';
  static ERROR = 'error';
}
```

#### SecurityGroup
```javascript
class SecurityGroup {
  constructor(securityGroupId, accountId, groupName, vpcId) {
    this.securityGroupId = securityGroupId;
    this.accountId = accountId;
    this.groupName = groupName;
    this.vpcId = vpcId;
    this.description = null;
    this.ingressRules = [];
    this.egressRules = [];
    this.createdAt = new Date();
  }

  addIngressRule(rule) {
    this.validateRule(rule);
    this.ingressRules.push({
      ...rule,
      ruleId: this.generateRuleId(),
      createdAt: new Date()
    });
  }

  addEgressRule(rule) {
    this.validateRule(rule);
    this.egressRules.push({
      ...rule,
      ruleId: this.generateRuleId(),
      createdAt: new Date()
    });
  }

  removeIngressRule(ruleId) {
    this.ingressRules = this.ingressRules.filter(r => r.ruleId !== ruleId);
  }

  removeEgressRule(ruleId) {
    this.egressRules = this.egressRules.filter(r => r.ruleId !== ruleId);
  }

  validateRule(rule) {
    if (!rule.protocol) {
      throw new Error('Protocol is required');
    }
    if (rule.protocol !== '-1' && (!rule.fromPort || !rule.toPort)) {
      throw new Error('Ports are required for non-all protocol');
    }
    if (!rule.source && !rule.sourceSecurityGroupId) {
      throw new Error('Either source CIDR or source security group is required');
    }
  }

  generateRuleId() {
    return `sgr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  evaluateIngress(ipAddress, port, protocol) {
    return this.ingressRules.some(rule => {
      if (rule.protocol !== '-1' && rule.protocol !== protocol) {
        return false;
      }
      if (rule.protocol !== '-1') {
        if (port < rule.fromPort || port > rule.toPort) {
          return false;
        }
      }
      if (rule.source) {
        return this.isIpInCidr(ipAddress, rule.source);
      }
      return true; // Source security group check handled separately
    });
  }

  evaluateEgress(ipAddress, port, protocol) {
    return this.egressRules.some(rule => {
      if (rule.protocol !== '-1' && rule.protocol !== protocol) {
        return false;
      }
      if (rule.protocol !== '-1') {
        if (port < rule.fromPort || port > rule.toPort) {
          return false;
        }
      }
      if (rule.destination) {
        return this.isIpInCidr(ipAddress, rule.destination);
      }
      return true;
    });
  }

  isIpInCidr(ip, cidr) {
    const [network, prefixLength] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(prefixLength)) - 1);
    const networkNum = this.ipToNumber(network) & mask;
    const ipNum = this.ipToNumber(ip) & mask;
    return networkNum === ipNum;
  }

  ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}
```

#### HypervisorHost
```javascript
class HypervisorHost {
  constructor(hostId, availabilityZone, hostType) {
    this.hostId = hostId;
    this.availabilityZone = availabilityZone;
    this.hostType = hostType;
    this.totalCpu = 0;
    this.totalMemory = 0; // in MB
    this.allocatedCpu = 0;
    this.allocatedMemory = 0;
    this.instances = [];
    this.state = HostState.ACTIVE;
    this.utilization = 0;
    this.lastHealthCheck = new Date();
  }

  allocateResources(cpu, memory) {
    if (!this.canAllocate(cpu, memory)) {
      throw new Error('Insufficient resources on host');
    }
    this.allocatedCpu += cpu;
    this.allocatedMemory += memory;
    this.updateUtilization();
  }

  deallocateResources(cpu, memory) {
    this.allocatedCpu = Math.max(0, this.allocatedCpu - cpu);
    this.allocatedMemory = Math.max(0, this.allocatedMemory - memory);
    this.updateUtilization();
  }

  canAllocate(cpu, memory) {
    const availableCpu = this.totalCpu - this.allocatedCpu;
    const availableMemory = this.totalMemory - this.allocatedMemory;
    return availableCpu >= cpu && availableMemory >= memory;
  }

  addInstance(instanceId) {
    if (!this.instances.includes(instanceId)) {
      this.instances.push(instanceId);
    }
  }

  removeInstance(instanceId) {
    this.instances = this.instances.filter(id => id !== instanceId);
  }

  updateUtilization() {
    const cpuUtil = (this.allocatedCpu / this.totalCpu) * 100;
    const memUtil = (this.allocatedMemory / this.totalMemory) * 100;
    this.utilization = Math.max(cpuUtil, memUtil);
  }

  markAsUnhealthy() {
    this.state = HostState.UNHEALTHY;
  }

  markAsHealthy() {
    this.state = HostState.ACTIVE;
    this.lastHealthCheck = new Date();
  }

  isHealthy() {
    return this.state === HostState.ACTIVE;
  }

  getAvailableResources() {
    return {
      cpu: this.totalCpu - this.allocatedCpu,
      memory: this.totalMemory - this.allocatedMemory
    };
  }
}

class HostState {
  static ACTIVE = 'active';
  static UNHEALTHY = 'unhealthy';
  static MAINTENANCE = 'maintenance';
  static RETIRED = 'retired';
}
```

### Service Classes

#### InstanceManagementService
```javascript
class InstanceManagementService {
  constructor(
    instanceRepository,
    orchestrationService,
    networkingService,
    storageService,
    eventPublisher,
    cacheService
  ) {
    this.instanceRepository = instanceRepository;
    this.orchestrationService = orchestrationService;
    this.networkingService = networkingService;
    this.storageService = storageService;
    this.eventPublisher = eventPublisher;
    this.cacheService = cacheService;
  }

  async launchInstance(accountId, launchRequest) {
    const {
      imageId,
      instanceType,
      keyName,
      securityGroupIds,
      subnetId,
      userData,
      minCount = 1,
      maxCount = 1
    } = launchRequest;

    // Validate request
    await this.validateLaunchRequest(accountId, launchRequest);

    const instances = [];
    
    for (let i = 0; i < maxCount; i++) {
      // Generate instance ID
      const instanceId = this.generateInstanceId();
      
      // Create instance record
      const instance = new Instance(instanceId, accountId, imageId, instanceType);
      instance.keyName = keyName;
      instance.securityGroupIds = securityGroupIds || [];
      instance.subnetId = subnetId;
      instance.userData = userData;
      instance.launchTime = new Date();

      // Save to database
      await this.instanceRepository.save(instance);

      // Publish launch event
      await this.eventPublisher.publish('InstanceLaunchRequested', {
        instanceId,
        accountId,
        imageId,
        instanceType,
        subnetId
      });

      instances.push(instance);
    }

    // Return pending instances (actual launch happens asynchronously)
    return instances.map(inst => ({
      instanceId: inst.instanceId,
      state: inst.state.value,
      instanceType: inst.instanceType,
      launchTime: inst.launchTime
    }));
  }

  async startInstance(instanceId, accountId) {
    const instance = await this.instanceRepository.findById(instanceId);
    
    if (!instance || instance.accountId !== accountId) {
      throw new Error('Instance not found');
    }

    if (instance.state.value !== InstanceState.STOPPED.value) {
      throw new Error(`Cannot start instance in state: ${instance.state.value}`);
    }

    instance.start();
    await this.instanceRepository.save(instance);

    // Publish event for orchestration
    await this.eventPublisher.publish('InstanceStartRequested', {
      instanceId,
      accountId
    });

    return {
      instanceId,
      previousState: InstanceState.STOPPED.value,
      currentState: instance.state.value
    };
  }

  async stopInstance(instanceId, accountId) {
    const instance = await this.instanceRepository.findById(instanceId);
    
    if (!instance || instance.accountId !== accountId) {
      throw new Error('Instance not found');
    }

    instance.stop();
    await this.instanceRepository.save(instance);

    await this.eventPublisher.publish('InstanceStopRequested', {
      instanceId,
      accountId
    });

    return {
      instanceId,
      previousState: InstanceState.RUNNING.value,
      currentState: instance.state.value
    };
  }

  async terminateInstance(instanceId, accountId) {
    const instance = await this.instanceRepository.findById(instanceId);
    
    if (!instance || instance.accountId !== accountId) {
      throw new Error('Instance not found');
    }

    instance.terminate();
    await this.instanceRepository.save(instance);

    await this.eventPublisher.publish('InstanceTerminateRequested', {
      instanceId,
      accountId
    });

    return {
      instanceId,
      previousState: instance.state.value,
      currentState: InstanceState.SHUTTING_DOWN.value
    };
  }

  async describeInstances(accountId, filters = {}) {
    const { instanceIds, states, instanceTypes } = filters;
    
    let instances = await this.instanceRepository.findByAccount(accountId);

    if (instanceIds && instanceIds.length > 0) {
      instances = instances.filter(inst => instanceIds.includes(inst.instanceId));
    }

    if (states && states.length > 0) {
      instances = instances.filter(inst => states.includes(inst.state.value));
    }

    if (instanceTypes && instanceTypes.length > 0) {
      instances = instances.filter(inst => instanceTypes.includes(inst.instanceType));
    }

    return instances.map(inst => this.toInstanceDTO(inst));
  }

  async modifyInstance(instanceId, accountId, modifications) {
    const instance = await this.instanceRepository.findById(instanceId);
    
    if (!instance || instance.accountId !== accountId) {
      throw new Error('Instance not found');
    }

    if (modifications.instanceType) {
      // Instance type change requires stop
      if (instance.state.value !== InstanceState.STOPPED.value) {
        throw new Error('Instance must be stopped to change instance type');
      }
      instance.instanceType = modifications.instanceType;
    }

    if (modifications.securityGroupIds) {
      instance.securityGroupIds = modifications.securityGroupIds;
    }

    await this.instanceRepository.save(instance);
    await this.cacheService.invalidate(`instance:${instanceId}`);

    return {
      instanceId,
      modifications
    };
  }

  async handleInstanceRunning(instanceId, placement) {
    const instance = await this.instanceRepository.findById(instanceId);
    
    instance.transitionTo(InstanceState.RUNNING);
    instance.availabilityZone = placement.availabilityZone;
    instance.hypervisorHostId = placement.hostId;
    instance.privateIpAddress = placement.privateIpAddress;
    instance.publicIpAddress = placement.publicIpAddress;

    await this.instanceRepository.save(instance);
    await this.cacheService.set(`instance:${instanceId}`, instance, { ttl: 3600 });

    await this.eventPublisher.publish('InstanceRunning', {
      instanceId,
      accountId: instance.accountId
    });
  }

  async validateLaunchRequest(accountId, request) {
    // Validate image exists and is available
    // Validate instance type exists
    // Validate security groups exist
    // Validate subnet exists
    // Check account limits
    // Validate user data size
    return true;
  }

  generateInstanceId() {
    return `i-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }

  toInstanceDTO(instance) {
    return {
      instanceId: instance.instanceId,
      state: instance.state.value,
      instanceType: instance.instanceType,
      imageId: instance.imageId,
      launchTime: instance.launchTime,
      privateIpAddress: instance.privateIpAddress,
      publicIpAddress: instance.publicIpAddress,
      vpcId: instance.vpcId,
      subnetId: instance.subnetId,
      securityGroups: instance.securityGroupIds.map(sgId => ({
        groupId: sgId
      })),
      tags: Object.fromEntries(instance.tags)
    };
  }
}
```

#### OrchestrationService
```javascript
class OrchestrationService {
  constructor(
    hostRepository,
    instanceRepository,
    ipAllocationService,
    placementStrategy
  ) {
    this.hostRepository = hostRepository;
    this.instanceRepository = instanceRepository;
    this.ipAllocationService = ipAllocationService;
    this.placementStrategy = placementStrategy;
  }

  async placeInstance(instanceId, requirements) {
    const { instanceType, subnetId, availabilityZone } = requirements;
    
    // Get instance type resource requirements
    const instanceTypeObj = InstanceType[instanceType.toUpperCase().replace('.', '_')];
    if (!instanceTypeObj) {
      throw new Error(`Invalid instance type: ${instanceType}`);
    }

    const resourceRequirements = instanceTypeObj.getResourceRequirements();

    // Select availability zone
    const az = availabilityZone || await this.selectAvailabilityZone(subnetId);

    // Find suitable host
    const host = await this.placementStrategy.findHost(az, resourceRequirements);

    if (!host) {
      throw new Error('No suitable host found for instance placement');
    }

    // Allocate IP addresses
    const privateIp = await this.ipAllocationService.allocatePrivateIp(subnetId);
    const publicIp = await this.ipAllocationService.allocatePublicIp();

    // Reserve resources on host
    host.allocateResources(
      resourceRequirements.cpu,
      resourceRequirements.memory
    );
    host.addInstance(instanceId);
    await this.hostRepository.save(host);

    return {
      instanceId,
      hostId: host.hostId,
      availabilityZone: az,
      privateIpAddress: privateIp,
      publicIpAddress: publicIp
    };
  }

  async selectAvailabilityZone(subnetId) {
    // Get availability zones with capacity
    const azs = await this.hostRepository.findAvailabilityZonesWithCapacity();
    
    // Prefer AZ of subnet if available
    if (subnetId) {
      const subnet = await this.getSubnet(subnetId);
      if (azs.includes(subnet.availabilityZone)) {
        return subnet.availabilityZone;
      }
    }

    // Select AZ with most available capacity
    return azs[0];
  }

  async migrateInstance(instanceId, reason) {
    const instance = await this.instanceRepository.findById(instanceId);
    const currentHost = await this.hostRepository.findById(instance.hypervisorHostId);

    // Find new host
    const requirements = {
      instanceType: instance.instanceType,
      subnetId: instance.subnetId,
      availabilityZone: instance.availabilityZone
    };

    const newPlacement = await this.placeInstance(instanceId, requirements);

    // Deallocate from old host
    const instanceTypeObj = InstanceType[instance.instanceType.toUpperCase().replace('.', '_')];
    const resources = instanceTypeObj.getResourceRequirements();
    currentHost.deallocateResources(resources.cpu, resources.memory);
    currentHost.removeInstance(instanceId);
    await this.hostRepository.save(currentHost);

    // Update instance
    instance.hypervisorHostId = newPlacement.hostId;
    await this.instanceRepository.save(instance);

    await this.eventPublisher.publish('InstanceMigrated', {
      instanceId,
      oldHostId: currentHost.hostId,
      newHostId: newPlacement.hostId,
      reason
    });
  }
}
```

#### PlacementStrategy (Strategy Pattern)
```javascript
class PlacementStrategy {
  async findHost(availabilityZone, requirements) {
    throw new Error('findHost must be implemented by subclass');
  }
}

class SpreadPlacementStrategy extends PlacementStrategy {
  constructor(hostRepository) {
    super();
    this.hostRepository = hostRepository;
  }

  async findHost(availabilityZone, requirements) {
    // Find hosts with available resources
    const hosts = await this.hostRepository.findByAvailabilityZone(availabilityZone);
    
    const suitableHosts = hosts
      .filter(host => host.isHealthy())
      .filter(host => host.canAllocate(requirements.cpu, requirements.memory))
      .sort((a, b) => {
        // Prefer hosts with fewer instances (spread distribution)
        return a.instances.length - b.instances.length;
      });

    return suitableHosts[0] || null;
  }
}

class ClusterPlacementStrategy extends PlacementStrategy {
  constructor(hostRepository) {
    super();
    this.hostRepository = hostRepository;
  }

  async findHost(availabilityZone, requirements) {
    const hosts = await this.hostRepository.findByAvailabilityZone(availabilityZone);
    
    const suitableHosts = hosts
      .filter(host => host.isHealthy())
      .filter(host => host.canAllocate(requirements.cpu, requirements.memory))
      .sort((a, b) => {
        // Prefer hosts with more instances (cluster distribution)
        return b.instances.length - a.instances.length;
      });

    return suitableHosts[0] || null;
  }
}
```

#### StorageManagementService
```javascript
class StorageManagementService {
  constructor(
    volumeRepository,
    snapshotRepository,
    storageBackend,
    eventPublisher
  ) {
    this.volumeRepository = volumeRepository;
    this.snapshotRepository = snapshotRepository;
    this.storageBackend = storageBackend;
    this.eventPublisher = eventPublisher;
  }

  async createVolume(accountId, request) {
    const {
      availabilityZone,
      volumeType,
      size,
      encrypted = false,
      kmsKeyId = null
    } = request;

    const volumeId = this.generateVolumeId();
    const volume = new Volume(volumeId, accountId, availabilityZone, volumeType, size);
    volume.encrypted = encrypted;
    volume.kmsKeyId = kmsKeyId;

    await this.volumeRepository.save(volume);

    // Create volume in storage backend
    await this.storageBackend.createVolume(volumeId, {
      size,
      volumeType,
      encrypted,
      kmsKeyId
    });

    volume.markAsAvailable();
    await this.volumeRepository.save(volume);

    return {
      volumeId,
      state: volume.state,
      size,
      volumeType,
      availabilityZone
    };
  }

  async attachVolume(volumeId, instanceId, device, accountId) {
    const volume = await this.volumeRepository.findById(volumeId);
    
    if (!volume || volume.accountId !== accountId) {
      throw new Error('Volume not found');
    }

    if (!volume.isAvailable()) {
      throw new Error(`Volume is not available: ${volume.state}`);
    }

    volume.attach(instanceId, device);
    await this.volumeRepository.save(volume);

    // Attach in storage backend
    await this.storageBackend.attachVolume(volumeId, instanceId, device);

    volume.markAsAttached();
    await this.volumeRepository.save(volume);

    return {
      volumeId,
      instanceId,
      device,
      state: volume.state
    };
  }

  async detachVolume(volumeId, accountId) {
    const volume = await this.volumeRepository.findById(volumeId);
    
    if (!volume || volume.accountId !== accountId) {
      throw new Error('Volume not found');
    }

    if (!volume.isAttached()) {
      throw new Error('Volume is not attached');
    }

    const instanceId = volume.attachedTo;
    
    await this.storageBackend.detachVolume(volumeId, instanceId);
    volume.detach();
    await this.volumeRepository.save(volume);

    return {
      volumeId,
      state: volume.state
    };
  }

  async createSnapshot(volumeId, accountId, description = null) {
    const volume = await this.volumeRepository.findById(volumeId);
    
    if (!volume || volume.accountId !== accountId) {
      throw new Error('Volume not found');
    }

    const snapshotId = this.generateSnapshotId();
    const snapshot = {
      snapshotId,
      accountId,
      volumeId,
      state: 'pending',
      progress: 0,
      size: volume.size,
      encrypted: volume.encrypted,
      startTime: new Date(),
      description
    };

    await this.snapshotRepository.save(snapshot);

    // Create snapshot in storage backend (async)
    await this.storageBackend.createSnapshot(volumeId, snapshotId);

    return {
      snapshotId,
      state: snapshot.state,
      volumeId
    };
  }

  generateVolumeId() {
    return `vol-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSnapshotId() {
    return `snap-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### NetworkingService
```javascript
class NetworkingService {
  constructor(
    securityGroupRepository,
    subnetRepository,
    ipAllocationService,
    networkController
  ) {
    this.securityGroupRepository = securityGroupRepository;
    this.subnetRepository = subnetRepository;
    this.ipAllocationService = ipAllocationService;
    this.networkController = networkController;
  }

  async createSecurityGroup(accountId, request) {
    const { groupName, description, vpcId } = request;

    const securityGroupId = this.generateSecurityGroupId();
    const securityGroup = new SecurityGroup(
      securityGroupId,
      accountId,
      groupName,
      vpcId
    );
    securityGroup.description = description;

    await this.securityGroupRepository.save(securityGroup);

    return {
      securityGroupId,
      groupName,
      vpcId
    };
  }

  async addSecurityGroupRule(securityGroupId, accountId, rule) {
    const securityGroup = await this.securityGroupRepository.findById(securityGroupId);
    
    if (!securityGroup || securityGroup.accountId !== accountId) {
      throw new Error('Security group not found');
    }

    if (rule.type === 'ingress') {
      securityGroup.addIngressRule(rule);
    } else if (rule.type === 'egress') {
      securityGroup.addEgressRule(rule);
    } else {
      throw new Error('Invalid rule type');
    }

    await this.securityGroupRepository.save(securityGroup);

    // Update network controller
    await this.networkController.updateSecurityGroup(securityGroupId, securityGroup);

    return {
      securityGroupId,
      ruleId: securityGroup.ingressRules[securityGroup.ingressRules.length - 1]?.ruleId ||
              securityGroup.egressRules[securityGroup.egressRules.length - 1]?.ruleId
    };
  }

  async evaluateSecurityGroups(instanceId, packet) {
    const instance = await this.instanceRepository.findById(instanceId);
    const securityGroups = await Promise.all(
      instance.securityGroupIds.map(sgId =>
        this.securityGroupRepository.findById(sgId)
      )
    );

    // Check if any security group allows the traffic
    for (const sg of securityGroups) {
      if (packet.direction === 'ingress') {
        if (sg.evaluateIngress(packet.sourceIp, packet.port, packet.protocol)) {
          return { allowed: true, securityGroupId: sg.securityGroupId };
        }
      } else {
        if (sg.evaluateEgress(packet.destinationIp, packet.port, packet.protocol)) {
          return { allowed: true, securityGroupId: sg.securityGroupId };
        }
      }
    }

    return { allowed: false };
  }

  generateSecurityGroupId() {
    return `sg-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### BillingService
```javascript
class BillingService {
  constructor(billingRepository, pricingCalculator, eventSubscriber) {
    this.billingRepository = billingRepository;
    this.pricingCalculator = pricingCalculator;
    this.eventSubscriber = eventSubscriber;
    
    // Subscribe to instance lifecycle events
    this.eventSubscriber.subscribe('InstanceRunning', this.handleInstanceRunning.bind(this));
    this.eventSubscriber.subscribe('InstanceStopped', this.handleInstanceStopped.bind(this));
    this.eventSubscriber.subscribe('InstanceTerminated', this.handleInstanceTerminated.bind(this));
  }

  async handleInstanceRunning(event) {
    const { instanceId, accountId } = event;
    const instance = await this.instanceRepository.findById(instanceId);
    
    // Start billing
    await this.startBilling(instanceId, accountId, instance.instanceType);
  }

  async handleInstanceStopped(event) {
    const { instanceId } = event;
    // Stop billing
    await this.stopBilling(instanceId);
  }

  async handleInstanceTerminated(event) {
    const { instanceId } = event;
    // Finalize billing
    await this.finalizeBilling(instanceId);
  }

  async startBilling(instanceId, accountId, instanceType) {
    const billingRecord = {
      accountId,
      instanceId,
      resourceType: 'instance',
      resourceId: instanceId,
      usageStart: new Date(),
      usageEnd: null,
      instanceType,
      pricingModel: 'on-demand'
    };

    await this.billingRepository.create(billingRecord);
  }

  async stopBilling(instanceId) {
    const record = await this.billingRepository.findActiveByInstanceId(instanceId);
    if (record) {
      record.usageEnd = new Date();
      record.totalCost = this.pricingCalculator.calculateCost(
        record.instanceType,
        record.usageStart,
        record.usageEnd,
        record.pricingModel
      );
      await this.billingRepository.update(record);
    }
  }

  async finalizeBilling(instanceId) {
    await this.stopBilling(instanceId);
  }

  async getBillingSummary(accountId, startDate, endDate) {
    const records = await this.billingRepository.findByAccountAndDateRange(
      accountId,
      startDate,
      endDate
    );

    const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
    
    return {
      accountId,
      period: { startDate, endDate },
      totalCost,
      records: records.map(r => ({
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        usageStart: r.usageStart,
        usageEnd: r.usageEnd,
        cost: r.totalCost
      }))
    };
  }
}

class PricingCalculator {
  constructor() {
    this.pricing = {
      't3.micro': { onDemand: 0.0104, reserved: 0.0062 }, // per hour
      't3.small': { onDemand: 0.0208, reserved: 0.0124 },
      't3.medium': { onDemand: 0.0416, reserved: 0.0248 },
      't3.large': { onDemand: 0.0832, reserved: 0.0496 },
      'c5.large': { onDemand: 0.085, reserved: 0.051 },
      'm5.large': { onDemand: 0.096, reserved: 0.0576 }
    };
  }

  calculateCost(instanceType, startTime, endTime, pricingModel = 'on-demand') {
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    const pricePerHour = this.pricing[instanceType]?.[pricingModel] || 0;
    return hours * pricePerHour;
  }
}
```

## Database Schema

The database schema matches the HLD design. Key tables include:

- `instances` - Instance metadata
- `instance_tags` - Instance tags
- `security_groups` - Security group definitions
- `security_group_rules` - Security group rules
- `images` - AMI images
- `volumes` - EBS volumes
- `volume_attachments` - Volume to instance mappings
- `snapshots` - Volume snapshots
- `instance_metrics` - Time-series metrics
- `billing_records` - Billing information

See HLD document for complete schema definitions.

## API Design

### REST API Endpoints

#### Instance Management

```javascript
// Launch Instance
POST /api/v1/instances
Body: {
  imageId: string,
  instanceType: string,
  keyName?: string,
  securityGroupIds?: string[],
  subnetId?: string,
  userData?: string,
  minCount?: number,
  maxCount?: number
}
Response: {
  instances: [{
    instanceId: string,
    state: string,
    instanceType: string,
    launchTime: Date
  }]
}

// Describe Instances
GET /api/v1/instances?instanceIds=id1,id2&states=running,stopped
Response: {
  instances: [InstanceDTO]
}

// Start Instance
POST /api/v1/instances/{instanceId}/start
Response: {
  instanceId: string,
  previousState: string,
  currentState: string
}

// Stop Instance
POST /api/v1/instances/{instanceId}/stop
Response: {
  instanceId: string,
  previousState: string,
  currentState: string
}

// Terminate Instance
POST /api/v1/instances/{instanceId}/terminate
Response: {
  instanceId: string,
  previousState: string,
  currentState: string
}

// Modify Instance
PUT /api/v1/instances/{instanceId}
Body: {
  instanceType?: string,
  securityGroupIds?: string[]
}
Response: {
  instanceId: string,
  modifications: object
}
```

#### Volume Management

```javascript
// Create Volume
POST /api/v1/volumes
Body: {
  availabilityZone: string,
  volumeType: string,
  size: number,
  encrypted?: boolean,
  kmsKeyId?: string
}
Response: {
  volumeId: string,
  state: string,
  size: number,
  volumeType: string
}

// Attach Volume
POST /api/v1/volumes/{volumeId}/attach
Body: {
  instanceId: string,
  device: string
}
Response: {
  volumeId: string,
  instanceId: string,
  device: string,
  state: string
}

// Detach Volume
POST /api/v1/volumes/{volumeId}/detach
Response: {
  volumeId: string,
  state: string
}
```

#### Security Group Management

```javascript
// Create Security Group
POST /api/v1/security-groups
Body: {
  groupName: string,
  description?: string,
  vpcId: string
}
Response: {
  securityGroupId: string,
  groupName: string,
  vpcId: string
}

// Add Security Group Rule
POST /api/v1/security-groups/{securityGroupId}/rules
Body: {
  type: 'ingress' | 'egress',
  protocol: string,
  fromPort?: number,
  toPort?: number,
  source?: string,
  sourceSecurityGroupId?: string,
  description?: string
}
Response: {
  securityGroupId: string,
  ruleId: string
}
```

## Key Algorithms

### Instance Placement Algorithm

```javascript
class PlacementAlgorithm {
  async findOptimalHost(requirements, constraints) {
    const {
      instanceType,
      availabilityZone,
      placementStrategy = 'spread',
      dedicatedTenancy = false
    } = requirements;

    // Get instance type requirements
    const instanceTypeObj = this.getInstanceType(instanceType);
    const resources = instanceTypeObj.getResourceRequirements();

    // Get candidate hosts
    let candidates = await this.hostRepository.findByAvailabilityZone(availabilityZone);
    
    // Filter by health
    candidates = candidates.filter(host => host.isHealthy());
    
    // Filter by resource availability
    candidates = candidates.filter(host =>
      host.canAllocate(resources.cpu, resources.memory)
    );

    // Filter by tenancy
    if (dedicatedTenancy) {
      candidates = candidates.filter(host => host.isDedicated());
    }

    // Apply placement strategy
    if (placementStrategy === 'spread') {
      return this.spreadPlacement(candidates);
    } else if (placementStrategy === 'cluster') {
      return this.clusterPlacement(candidates);
    } else {
      return this.randomPlacement(candidates);
    }
  }

  spreadPlacement(candidates) {
    // Prefer hosts with fewer instances
    return candidates.sort((a, b) => 
      a.instances.length - b.instances.length
    )[0];
  }

  clusterPlacement(candidates) {
    // Prefer hosts with more instances (for low latency)
    return candidates.sort((a, b) => 
      b.instances.length - a.instances.length
    )[0];
  }

  randomPlacement(candidates) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
```

### IP Address Allocation

```javascript
class IPAllocationService {
  constructor(subnetRepository, ipPool) {
    this.subnetRepository = subnetRepository;
    this.ipPool = ipPool;
  }

  async allocatePrivateIp(subnetId) {
    const subnet = await this.subnetRepository.findById(subnetId);
    const cidr = subnet.cidrBlock;
    
    // Get allocated IPs for this subnet
    const allocatedIps = await this.getAllocatedIps(subnetId);
    
    // Find first available IP in CIDR range
    const [network, prefixLength] = cidr.split('/');
    const networkNum = this.ipToNumber(network);
    const mask = ~(2 ** (32 - parseInt(prefixLength)) - 1);
    const startIp = (networkNum & mask) + 1; // Skip network address
    const endIp = networkNum | (~mask);

    for (let ipNum = startIp; ipNum < endIp; ipNum++) {
      const ip = this.numberToIp(ipNum);
      if (!allocatedIps.has(ip)) {
        await this.reserveIp(subnetId, ip);
        return ip;
      }
    }

    throw new Error('No available IP addresses in subnet');
  }

  async allocatePublicIp() {
    return await this.ipPool.allocate();
  }

  ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  numberToIp(num) {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.');
  }
}
```

### Security Group Rule Evaluation

```javascript
class SecurityGroupEvaluator {
  evaluatePacket(securityGroups, packet) {
    const { direction, protocol, sourceIp, destinationIp, port } = packet;

    for (const sg of securityGroups) {
      if (direction === 'ingress') {
        if (this.evaluateIngress(sg, sourceIp, port, protocol)) {
          return { allowed: true, securityGroupId: sg.securityGroupId };
        }
      } else {
        if (this.evaluateEgress(sg, destinationIp, port, protocol)) {
          return { allowed: true, securityGroupId: sg.securityGroupId };
        }
      }
    }

    return { allowed: false };
  }

  evaluateIngress(securityGroup, sourceIp, port, protocol) {
    return securityGroup.ingressRules.some(rule => {
      // Protocol match
      if (rule.protocol !== '-1' && rule.protocol !== protocol) {
        return false;
      }

      // Port range match
      if (rule.protocol !== '-1') {
        if (port < rule.fromPort || port > rule.toPort) {
          return false;
        }
      }

      // Source IP match
      if (rule.source) {
        return this.isIpInCidr(sourceIp, rule.source);
      }

      // Source security group (handled separately)
      if (rule.sourceSecurityGroupId) {
        return this.checkSourceSecurityGroup(rule.sourceSecurityGroupId, sourceIp);
      }

      return false;
    });
  }

  evaluateEgress(securityGroup, destinationIp, port, protocol) {
    return securityGroup.egressRules.some(rule => {
      if (rule.protocol !== '-1' && rule.protocol !== protocol) {
        return false;
      }

      if (rule.protocol !== '-1') {
        if (port < rule.fromPort || port > rule.toPort) {
          return false;
        }
      }

      if (rule.destination) {
        return this.isIpInCidr(destinationIp, rule.destination);
      }

      return true; // Default allow all egress
    });
  }

  isIpInCidr(ip, cidr) {
    const [network, prefixLength] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(prefixLength)) - 1);
    const networkNum = this.ipToNumber(network) & mask;
    const ipNum = this.ipToNumber(ip) & mask;
    return networkNum === ipNum;
  }

  ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}
```

## Design Patterns

### 1. State Pattern (Instance Lifecycle)

```javascript
// InstanceState class implements state pattern
// Each state defines allowed transitions
class InstanceState {
  constructor(value, allowedTransitions = []) {
    this.value = value;
    this.allowedTransitions = allowedTransitions;
  }

  canTransitionTo(newState) {
    return this.allowedTransitions.includes(newState.value);
  }
}
```

### 2. Strategy Pattern (Placement Strategies)

```javascript
// Different placement strategies (spread, cluster, partition)
class PlacementStrategy {
  async findHost(availabilityZone, requirements) {
    throw new Error('Must be implemented');
  }
}

class SpreadPlacementStrategy extends PlacementStrategy { }
class ClusterPlacementStrategy extends PlacementStrategy { }
```

### 3. Factory Pattern (Instance Creation)

```javascript
class InstanceFactory {
  static create(accountId, launchRequest) {
    const instance = new Instance(
      this.generateInstanceId(),
      accountId,
      launchRequest.imageId,
      launchRequest.instanceType
    );
    
    // Apply configuration
    if (launchRequest.keyName) {
      instance.keyName = launchRequest.keyName;
    }
    
    return instance;
  }

  static generateInstanceId() {
    return `i-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 4. Observer Pattern (Event-Driven Architecture)

```javascript
class EventPublisher {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(handler);
  }

  async publish(eventType, eventData) {
    const handlers = this.subscribers.get(eventType) || [];
    await Promise.all(handlers.map(handler => handler(eventData)));
  }
}

// Usage
eventPublisher.subscribe('InstanceRunning', async (event) => {
  await billingService.startBilling(event.instanceId);
  await monitoringService.startMonitoring(event.instanceId);
});
```

### 5. Repository Pattern (Data Access)

```javascript
class InstanceRepository {
  constructor(database) {
    this.db = database;
  }

  async save(instance) {
    // Save to database
    await this.db.instances.upsert(instance);
  }

  async findById(instanceId) {
    return await this.db.instances.findOne({ instanceId });
  }

  async findByAccount(accountId) {
    return await this.db.instances.find({ accountId });
  }
}
```

### 6. Service Layer Pattern

```javascript
// Business logic separated into service classes
// InstanceManagementService, StorageManagementService, etc.
// Services coordinate be
// Business logic separated into service classes
// InstanceManagementService, StorageManagementService, etc.
// Services coordinate between repositories, external systems, and business logic
class InstanceManagementService {
  constructor(
    instanceRepository,
    orchestrationService,
    networkingService,
    eventPublisher
  ) {
    this.instanceRepository = instanceRepository;
    this.orchestrationService = orchestrationService;
    this.networkingService = networkingService;
    this.eventPublisher = eventPublisher;
  }

  async launchInstance(accountId, request) {
    // Validate, create, and launch instance
    // Coordinate with multiple services
  }
}
```

### Singleton Pattern(Service Instances)

```js
class ServiceRegistry {
  constructor() {
    if (ServiceRegistry.instance) {
      return ServiceRegistry.instance;
    }
    
    this.services = new Map();
    ServiceRegistry.instance = this;
  }

  register(name, service) {
    this.services.set(name, service);
  }

  get(name) {
    return this.services.get(name);
  }
}

// Usage
const registry = new ServiceRegistry();
registry.register('instanceService', new InstanceManagementService(...));
```
## Error Handling

### Custom Exception Classes

```javascript
class EC2Exception extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'EC2Exception';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class InstanceNotFoundException extends EC2Exception {
  constructor(instanceId) {
    super(`Instance ${instanceId} not found`, 'InstanceNotFound', 404);
    this.instanceId = instanceId;
  }
}

class InvalidStateTransitionException extends EC2Exception {
  constructor(currentState, targetState) {
    super(
      `Cannot transition from ${currentState} to ${targetState}`,
      'InvalidStateTransition',
      400
    );
    this.currentState = currentState;
    this.targetState = targetState;
  }
}

class InsufficientCapacityException extends EC2Exception {
  constructor(availabilityZone, instanceType) {
    super(
      `Insufficient capacity for ${instanceType} in ${availabilityZone}`,
      'InsufficientCapacity',
      503
    );
    this.availabilityZone = availabilityZone;
    this.instanceType = instanceType;
  }
}

class ResourceLimitExceededException extends EC2Exception {
  constructor(resourceType, limit) {
    super(
      `Resource limit exceeded for ${resourceType}. Limit: ${limit}`,
      'ResourceLimitExceeded',
      403
    );
    this.resourceType = resourceType;
    this.limit = limit;
  }
}
```

### Error Handling Middleware

```javascript
class ErrorHandler {
  static handle(error, req, res, next) {
    if (error instanceof EC2Exception) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...error
        }
      });
    }

    // Log unexpected errors
    console.error('Unexpected error:', error);
    
    return res.status(500).json({
      error: {
        code: 'InternalError',
        message: 'An internal error occurred'
      }
    });
  }

  static async handleAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof EC2Exception) {
        throw error;
      }
      throw new EC2Exception(
        error.message || 'An unexpected error occurred',
        'InternalError'
      );
    }
  }
}
```

### Retry Logic with Exponential Backoff

```javascript
class RetryHandler {
  static async retryWithBackoff(
    fn,
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000
  ) {
    let delay = initialDelay;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Skip retry for non-retryable errors
        if (error instanceof InvalidStateTransitionException) {
          throw error;
        }
        
        await this.sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
await RetryHandler.retryWithBackoff(async () => {
  return await storageService.attachVolume(volumeId, instanceId);
});
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const storageCircuitBreaker = new CircuitBreaker(5, 60000);
await storageCircuitBreaker.execute(async () => {
  return await storageBackend.createVolume(volumeId, config);
});
```

## Performance Optimizations

### Caching Strategy

```javascript
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.defaultTTL = 3600; // 1 hour
  }

  async get(key) {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getOrSet(key, fetchFn, options = {}) {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, options);
    return value;
  }
}

// Usage in services
async describeInstances(accountId, filters) {
  const cacheKey = `instances:${accountId}:${JSON.stringify(filters)}`;
  
  return await this.cacheService.getOrSet(
    cacheKey,
    async () => {
      return await this.instanceRepository.findByAccount(accountId);
    },
    { ttl: 300 } // 5 minutes
  );
}
```

### Database Query Optimization

```javascript
class OptimizedInstanceRepository {
  constructor(database, cacheService) {
    this.db = database;
    this.cache = cacheService;
  }

  async findById(instanceId) {
    // Check cache first
    const cached = await this.cache.get(`instance:${instanceId}`);
    if (cached) {
      return cached;
    }

    // Use indexed query
    const instance = await this.db.instances.findOne({
      where: { instanceId },
      include: [
        { model: this.db.instanceTags, as: 'tags' },
        { model: this.db.instanceSecurityGroups, as: 'securityGroups' }
      ]
    });

    if (instance) {
      await this.cache.set(`instance:${instanceId}`, instance, { ttl: 3600 });
    }

    return instance;
  }

  async findByAccount(accountId, options = {}) {
    const { limit = 100, offset = 0, states } = options;
    
    const query = {
      where: { accountId },
      limit,
      offset,
      order: [['launchTime', 'DESC']]
    };

    if (states && states.length > 0) {
      query.where.state = { [Op.in]: states };
    }

    return await this.db.instances.findAll(query);
  }

  async batchUpdate(instances) {
    // Use bulk update for better performance
    await this.db.instances.bulkCreate(instances, {
      updateOnDuplicate: ['state', 'updatedAt']
    });
  }
}
```

### Connection Pooling

```javascript
class DatabaseConnectionPool {
  constructor(config) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 20, // Maximum pool size
      min: 5,  // Minimum pool size
      idle: 10000, // Idle timeout
      acquire: 30000, // Max time to wait for connection
      evict: 1000 // Check for idle connections
    });
  }

  async query(sql, params) {
    const client = await this.pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### Async Processing with Message Queue

```javascript
class AsyncInstanceLauncher {
  constructor(messageQueue, instanceService, orchestrationService) {
    this.queue = messageQueue;
    this.instanceService = instanceService;
    this.orchestrationService = orchestrationService;
    
    this.setupConsumers();
  }

  setupConsumers() {
    // Consumer for launch requests
    this.queue.consume('InstanceLaunchRequested', async (message) => {
      const { instanceId, accountId, imageId, instanceType, subnetId } = message;
      
      try {
        // Place instance
        const placement = await this.orchestrationService.placeInstance(
          instanceId,
          { instanceType, subnetId }
        );

        // Download image
        await this.downloadImage(imageId, placement.hostId);

        // Create VM on hypervisor
        await this.createVM(instanceId, placement);

        // Update instance state
        await this.instanceService.handleInstanceRunning(instanceId, placement);
      } catch (error) {
        // Handle error and update instance state
        await this.handleLaunchError(instanceId, error);
      }
    });
  }

  async downloadImage(imageId, hostId) {
    // Download image from object storage to hypervisor host
    // This is a long-running operation, done asynchronously
  }

  async createVM(instanceId, placement) {
    // Create virtual machine on hypervisor
    // Configure networking, storage, etc.
  }
}
```

### Batch Operations

```javascript
class BatchOperationService {
  constructor(instanceRepository, eventPublisher) {
    this.instanceRepository = instanceRepository;
    this.eventPublisher = eventPublisher;
  }

  async batchStartInstances(instanceIds, accountId) {
    const instances = await this.instanceRepository.findByIds(instanceIds);
    
    // Validate all instances belong to account
    const invalidInstances = instances.filter(
      inst => inst.accountId !== accountId
    );
    if (invalidInstances.length > 0) {
      throw new Error('Some instances not found or access denied');
    }

    // Batch update state
    const updates = instances.map(inst => ({
      instanceId: inst.instanceId,
      state: InstanceState.PENDING.value,
      updatedAt: new Date()
    }));

    await this.instanceRepository.batchUpdate(updates);

    // Publish events in batch
    await Promise.all(
      instances.map(inst =>
        this.eventPublisher.publish('InstanceStartRequested', {
          instanceId: inst.instanceId,
          accountId
        })
      )
    );

    return {
      count: instances.length,
      instanceIds: instances.map(inst => inst.instanceId)
    };
  }

  async batchTerminateInstances(instanceIds, accountId) {
    // Similar batch operation for termination
  }
}
```

### Lazy Loading and Pagination

```javascript
class PaginatedInstanceService {
  async describeInstances(accountId, options = {}) {
    const {
      page = 1,
      pageSize = 50,
      filters = {}
    } = options;

    const offset = (page - 1) * pageSize;
    
    const { instances, total } = await this.instanceRepository.findPaginated(
      accountId,
      {
        offset,
        limit: pageSize,
        ...filters
      }
    );

    return {
      instances: instances.map(inst => this.toInstanceDTO(inst)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}
```

### Read Replicas for Scaling Reads

```javascript
class ReadReplicaRepository {
  constructor(masterDb, replicaDbs) {
    this.master = masterDb;
    this.replicas = replicaDbs;
    this.replicaIndex = 0;
  }

  getReplica() {
    // Round-robin selection
    const replica = this.replicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
    return replica;
  }

  async findById(instanceId) {
    // Use read replica for reads
    const replica = this.getReplica();
    return await replica.instances.findOne({ instanceId });
  }

  async save(instance) {
    // Always write to master
    await this.master.instances.upsert(instance);
  }
}
```

### Index Optimization

```javascript
// Database indexes for common queries
const indexes = {
  instances: [
    { fields: ['accountId', 'state'] }, // Filter by account and state
    { fields: ['accountId', 'launchTime'] }, // Sort by launch time
    { fields: ['hypervisorHostId'] }, // Find instances on host
    { fields: ['availabilityZone', 'state'] }, // AZ capacity queries
    { fields: ['instanceType', 'state'] } // Instance type queries
  ],
  volumes: [
    { fields: ['accountId', 'state'] },
    { fields: ['attachedTo'] }, // Find volumes attached to instance
    { fields: ['availabilityZone'] }
  ],
  securityGroups: [
    { fields: ['accountId', 'vpcId'] },
    { fields: ['securityGroupId'] }
  ]
};
```

## Summary

This LLD provides a comprehensive JavaScript implementation for an AWS EC2-like service with:

- **Core Domain Models**: Instance, Volume, Image, SecurityGroup, HypervisorHost
- **Service Layer**: InstanceManagementService, OrchestrationService, StorageManagementService, NetworkingService, BillingService
- **Design Patterns**: State, Strategy, Factory, Observer, Repository, Service Layer
- **Error Handling**: Custom exceptions, retry logic, circuit breakers
- **Performance**: Caching, connection pooling, async processing, batch operations, read replicas

The design supports:
- Millions of instances with efficient resource management
- High availability through health monitoring and auto-recovery
- Scalability through horizontal scaling and caching
- Security through network isolation and access control
- Cost optimization through efficient resource utilization

---

**Note**: This is a comprehensive LLD. In a production system, you would also need:
- Unit and integration tests
- API documentation (OpenAPI/Swagger)
- Deployment configurations
- Monitoring and alerting setup
- Security hardening
- Performance benchmarking results
```

Copy this content starting from line 1788 to complete the document. It includes:
1. Completion of the Service Layer Pattern section
2. Error Handling section with custom exceptions, retry logic, and circuit breakers
3. Performance Optimizations section with caching, database optimization, connection pooling, async processing, batch operations, and more
4. A summary section

The document now covers all the sections outlined in the table of contents.

```javascript
// Business logic separated into service classes
// InstanceManagementService, StorageManagementService, etc.
// Services coordinate between repositories, external systems, and business logic
class InstanceManagementService {
  constructor(
    instanceRepository,
    orchestrationService,
    networkingService,
    eventPublisher
  ) {
    this.instanceRepository = instanceRepository;
    this.orchestrationService = orchestrationService;
    this.networkingService = networkingService;
    this.eventPublisher = eventPublisher;
  }

  async launchInstance(accountId, request) {
    // Validate, create, and launch instance
    // Coordinate with multiple services
  }
}
```

```javascript
class ServiceRegistry {
  constructor() {
    if (ServiceRegistry.instance) {
      return ServiceRegistry.instance;
    }
    
    this.services = new Map();
    ServiceRegistry.instance = this;
  }

  register(name, service) {
    this.services.set(name, service);
  }

  get(name) {
    return this.services.get(name);
  }
}

// Usage
const registry = new ServiceRegistry();
registry.register('instanceService', new InstanceManagementService(...));
```

```javascript
class EC2Exception extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'EC2Exception';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class InstanceNotFoundException extends EC2Exception {
  constructor(instanceId) {
    super(`Instance ${instanceId} not found`, 'InstanceNotFound', 404);
    this.instanceId = instanceId;
  }
}

class InvalidStateTransitionException extends EC2Exception {
  constructor(currentState, targetState) {
    super(
      `Cannot transition from ${currentState} to ${targetState}`,
      'InvalidStateTransition',
      400
    );
    this.currentState = currentState;
    this.targetState = targetState;
  }
}

class InsufficientCapacityException extends EC2Exception {
  constructor(availabilityZone, instanceType) {
    super(
      `Insufficient capacity for ${instanceType} in ${availabilityZone}`,
      'InsufficientCapacity',
      503
    );
    this.availabilityZone = availabilityZone;
    this.instanceType = instanceType;
  }
}

class ResourceLimitExceededException extends EC2Exception {
  constructor(resourceType, limit) {
    super(
      `Resource limit exceeded for ${resourceType}. Limit: ${limit}`,
      'ResourceLimitExceeded',
      403
    );
    this.resourceType = resourceType;
    this.limit = limit;
  }
}
```

```javascript
class ErrorHandler {
  static handle(error, req, res, next) {
    if (error instanceof EC2Exception) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...error
        }
      });
    }

    // Log unexpected errors
    console.error('Unexpected error:', error);
    
    return res.status(500).json({
      error: {
        code: 'InternalError',
        message: 'An internal error occurred'
      }
    });
  }

  static async handleAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof EC2Exception) {
        throw error;
      }
      throw new EC2Exception(
        error.message || 'An unexpected error occurred',
        'InternalError'
      );
    }
  }
}
```

```javascript
class RetryHandler {
  static async retryWithBackoff(
    fn,
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000
  ) {
    let delay = initialDelay;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Skip retry for non-retryable errors
        if (error instanceof InvalidStateTransitionException) {
          throw error;
        }
        
        await this.sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
await RetryHandler.retryWithBackoff(async () => {
  return await storageService.attachVolume(volumeId, instanceId);
});
```

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const storageCircuitBreaker = new CircuitBreaker(5, 60000);
await storageCircuitBreaker.execute(async () => {
  return await storageBackend.createVolume(volumeId, config);
});
```

```javascript
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.defaultTTL = 3600; // 1 hour
  }

  async get(key) {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getOrSet(key, fetchFn, options = {}) {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, options);
    return value;
  }
}

// Usage in services
async describeInstances(accountId, filters) {
  const cacheKey = `instances:${accountId}:${JSON.stringify(filters)}`;
  
  return await this.cacheService.getOrSet(
    cacheKey,
    async () => {
      return await this.instanceRepository.findByAccount(accountId);
    },
    { ttl: 300 } // 5 minutes
  );
}
```

```javascript
class OptimizedInstanceRepository {
  constructor(database, cacheService) {
    this.db = database;
    this.cache = cacheService;
  }

  async findById(instanceId) {
    // Check cache first
    const cached = await this.cache.get(`instance:${instanceId}`);
    if (cached) {
      return cached;
    }

    // Use indexed query
    const instance = await this.db.instances.findOne({
      where: { instanceId },
      include: [
        { model: this.db.instanceTags, as: 'tags' },
        { model: this.db.instanceSecurityGroups, as: 'securityGroups' }
      ]
    });

    if (instance) {
      await this.cache.set(`instance:${instanceId}`, instance, { ttl: 3600 });
    }

    return instance;
  }

  async findByAccount(accountId, options = {}) {
    const { limit = 100, offset = 0, states } = options;
    
    const query = {
      where: { accountId },
      limit,
      offset,
      order: [['launchTime', 'DESC']]
    };

    if (states && states.length > 0) {
      query.where.state = { [Op.in]: states };
    }

    return await this.db.instances.findAll(query);
  }

  async batchUpdate(instances) {
    // Use bulk update for better performance
    await this.db.instances.bulkCreate(instances, {
      updateOnDuplicate: ['state', 'updatedAt']
    });
  }
}
```

```javascript
class DatabaseConnectionPool {
  constructor(config) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 20, // Maximum pool size
      min: 5,  // Minimum pool size
      idle: 10000, // Idle timeout
      acquire: 30000, // Max time to wait for connection
      evict: 1000 // Check for idle connections
    });
  }

  async query(sql, params) {
    const client = await this.pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

```javascript
class AsyncInstanceLauncher {
  constructor(messageQueue, instanceService, orchestrationService) {
    this.queue = messageQueue;
    this.instanceService = instanceService;
    this.orchestrationService = orchestrationService;
    
    this.setupConsumers();
  }

  setupConsumers() {
    // Consumer for launch requests
    this.queue.consume('InstanceLaunchRequested', async (message) => {
      const { instanceId, accountId, imageId, instanceType, subnetId } = message;
      
      try {
        // Place instance
        const placement = await this.orchestrationService.placeInstance(
          instanceId,
          { instanceType, subnetId }
        );

        // Download image
        await this.downloadImage(imageId, placement.hostId);

        // Create VM on hypervisor
        await this.createVM(instanceId, placement);

        // Update instance state
        await this.instanceService.handleInstanceRunning(instanceId, placement);
      } catch (error) {
        // Handle error and update instance state
        await this.handleLaunchError(instanceId, error);
      }
    });
  }

  async downloadImage(imageId, hostId) {
    // Download image from object storage to hypervisor host
    // This is a long-running operation, done asynchronously
  }

  async createVM(instanceId, placement) {
    // Create virtual machine on hypervisor
    // Configure networking, storage, etc.
  }
}
```

```javascript
class BatchOperationService {
  constructor(instanceRepository, eventPublisher) {
    this.instanceRepository = instanceRepository;
    this.eventPublisher = eventPublisher;
  }

  async batchStartInstances(instanceIds, accountId) {
    const instances = await this.instanceRepository.findByIds(instanceIds);
    
    // Validate all instances belong to account
    const invalidInstances = instances.filter(
      inst => inst.accountId !== accountId
    );
    if (invalidInstances.length > 0) {
      throw new Error('Some instances not found or access denied');
    }

    // Batch update state
    const updates = instances.map(inst => ({
      instanceId: inst.instanceId,
      state: InstanceState.PENDING.value,
      updatedAt: new Date()
    }));

    await this.instanceRepository.batchUpdate(updates);

    // Publish events in batch
    await Promise.all(
      instances.map(inst =>
        this.eventPublisher.publish('InstanceStartRequested', {
          instanceId: inst.instanceId,
          accountId
        })
      )
    );

    return {
      count: instances.length,
      instanceIds: instances.map(inst => inst.instanceId)
    };
  }

  async batchTerminateInstances(instanceIds, accountId) {
    // Similar batch operation for termination
  }
}
```

```javascript
class PaginatedInstanceService {
  async describeInstances(accountId, options = {}) {
    const {
      page = 1,
      pageSize = 50,
      filters = {}
    } = options;

    const offset = (page - 1) * pageSize;
    
    const { instances, total } = await this.instanceRepository.findPaginated(
      accountId,
      {
        offset,
        limit: pageSize,
        ...filters
      }
    );

    return {
      instances: instances.map(inst => this.toInstanceDTO(inst)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}
```

```javascript
class ReadReplicaRepository {
  constructor(masterDb, replicaDbs) {
    this.master = masterDb;
    this.replicas = replicaDbs;
    this.replicaIndex = 0;
  }

  getReplica() {
    // Round-robin selection
    const replica = this.replicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
    return replica;
  }

  async findById(instanceId) {
    // Use read replica for reads
    const replica = this.getReplica();
    return await replica.instances.findOne({ instanceId });
  }

  async save(instance) {
    // Always write to master
    await this.master.instances.upsert(instance);
  }
}
```

```javascript
// Database indexes for common queries
const indexes = {
  instances: [
    { fields: ['accountId', 'state'] }, // Filter by account and state
    { fields: ['accountId', 'launchTime'] }, // Sort by launch time
    { fields: ['hypervisorHostId'] }, // Find instances on host
    { fields: ['availabilityZone', 'state'] }, // AZ capacity queries
    { fields: ['instanceType', 'state'] } // Instance type queries
  ],
  volumes: [
    { fields: ['accountId', 'state'] },
    { fields: ['attachedTo'] }, // Find volumes attached to instance
    { fields: ['availabilityZone'] }
  ],
  securityGroups: [
    { fields: ['accountId', 'vpcId'] },
    { fields: ['securityGroupId'] }
  ]
};
```
