import { useState } from 'react';
import { Bluetooth, BluetoothConnected, BluetoothOff, BluetoothSearching, Loader2, AlertCircle, Server } from 'lucide-react';
import type { BluetoothStatus as BluetoothStatusType } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BluetoothStatusProps {
  status: BluetoothStatusType;
  onScan: () => void;
  onDisconnect: () => void;
  onEnableDemoMode?: () => void;
  onEnableServerUsb?: () => void;
}

export function BluetoothStatus({ status, onScan, onDisconnect, onEnableDemoMode, onEnableServerUsb }: BluetoothStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const getIcon = () => {
    if (status.connectionState === 'connected') return BluetoothConnected;
    if (status.connectionState === 'scanning' || status.connectionState === 'connecting') return BluetoothSearching;
    if (status.connectionState === 'error' || !status.isSupported) return BluetoothOff;
    return Bluetooth;
  };
  
  const getStatusText = () => {
    switch (status.connectionState) {
      case 'connected':
        return status.deviceName || 'KPro Connected';
      case 'scanning':
        return 'Scanning...';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Connect ECU';
    }
  };
  
  const getStatusColor = () => {
    switch (status.connectionState) {
      case 'connected':
        return 'text-gauge-green';
      case 'scanning':
      case 'connecting':
        return 'text-gauge-yellow animate-pulse';
      case 'error':
        return 'text-gauge-red';
      default:
        return 'text-muted-foreground';
    }
  };
  
  const Icon = getIcon();
  const isLoading = status.connectionState === 'scanning' || status.connectionState === 'connecting';
  
  if (!status.isSupported) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            data-testid="button-bluetooth-status"
          >
            <AlertCircle className="w-4 h-4 text-gauge-red" />
            <span className="font-sans text-xs text-gauge-red">
              Bluetooth Unavailable
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Connection Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Bluetooth and USB require Chrome/Chromium. Use Server USB for lightweight browsers like surf or midori.
          </div>
          <DropdownMenuSeparator />
          {onEnableServerUsb && (
            <DropdownMenuItem onClick={onEnableServerUsb} data-testid="menu-item-server-usb">
              <Server className="w-4 h-4 mr-2" />
              Server USB (Pi Serial)
            </DropdownMenuItem>
          )}
          {onEnableDemoMode && (
            <DropdownMenuItem onClick={onEnableDemoMode} data-testid="menu-item-demo-mode">
              Use Demo Mode
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={isLoading}
          data-testid="button-bluetooth-status"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gauge-yellow" />
          ) : (
            <Icon className={`w-4 h-4 ${getStatusColor()}`} />
          )}
          <span className={`font-sans text-xs ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Bluetooth Connection</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {status.connectionState === 'connected' ? (
          <>
            <div className="px-2 py-2">
              <div className="flex items-center gap-2 mb-2">
                <BluetoothConnected className="w-4 h-4 text-gauge-green" />
                <span className="text-sm font-medium text-gauge-green">Connected</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Device: {status.deviceName || 'Unknown'}</p>
                {status.lastDataReceived && (
                  <p>Last data: {new Date(status.lastDataReceived).toLocaleTimeString()}</p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDisconnect}
              className="text-gauge-red focus:text-gauge-red"
              data-testid="menu-item-disconnect"
            >
              Disconnect
            </DropdownMenuItem>
          </>
        ) : status.connectionState === 'error' ? (
          <>
            <div className="px-2 py-2">
              <div className="flex items-center gap-2 mb-2">
                <BluetoothOff className="w-4 h-4 text-gauge-red" />
                <span className="text-sm font-medium text-gauge-red">Error</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{status.error || 'Connection failed'}</p>
              {status.discoveredServices && status.discoveredServices.length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-[10px]">
                  <p className="font-medium mb-1">Services found:</p>
                  {status.discoveredServices.map((svc, i) => (
                    <div key={i} className="mb-1">
                      <code className="text-[9px] break-all">{svc.uuid}</code>
                      <span className="text-muted-foreground ml-1">
                        ({svc.characteristics.length} chars)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onScan} data-testid="menu-item-retry">
              Retry Connection
            </DropdownMenuItem>
            {onEnableServerUsb && (
              <DropdownMenuItem onClick={onEnableServerUsb} data-testid="menu-item-server-usb">
                <Server className="w-4 h-4 mr-2" />
                Server USB (Pi Serial)
              </DropdownMenuItem>
            )}
            {onEnableDemoMode && (
              <DropdownMenuItem onClick={onEnableDemoMode} data-testid="menu-item-demo-mode">
                Use Demo Mode
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <>
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <p>Tap "Scan for Devices" to find your KPro ECU via Bluetooth.</p>
              <p className="mt-2 text-[10px]">Requirements:</p>
              <ul className="mt-1 text-[10px] list-disc pl-3 space-y-0.5">
                <li>Bluetooth enabled on device</li>
                <li>Location enabled (required on Android)</li>
                <li>KPro V4 with BLE capability</li>
              </ul>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onScan} data-testid="menu-item-scan">
              <BluetoothSearching className="w-4 h-4 mr-2" />
              Scan for Devices
            </DropdownMenuItem>
            {onEnableServerUsb && (
              <DropdownMenuItem onClick={onEnableServerUsb} data-testid="menu-item-server-usb">
                <Server className="w-4 h-4 mr-2" />
                Server USB (Pi Serial)
              </DropdownMenuItem>
            )}
            {onEnableDemoMode && (
              <DropdownMenuItem onClick={onEnableDemoMode} data-testid="menu-item-demo-mode">
                Use Demo Mode Instead
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
